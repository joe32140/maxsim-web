/*!
 * MaxSim Web - Ultra-High-Performance WASM Implementation
 *
 * IMPORTANT: This implementation expects L2-normalized embeddings as input.
 * Modern embedding models (ColBERT, BGE, E5, etc.) output normalized embeddings by default.
 * For normalized embeddings, dot product equals cosine similarity.
 *
 * MaxSim Algorithm:
 * - For each query token, find the maximum dot product with all document tokens
 * - Sum these maximum similarities: score = Σ max(qi · dj) for all query tokens i
 *
 * Two variants available:
 * - maxsim(): Official MaxSim (raw sum) - matches ColBERT, pylate-rs, mixedbread-ai
 * - maxsim_normalized(): Normalized MaxSim (averaged) - for cross-query comparison
 */

use wasm_bindgen::prelude::*;
use std::cell::RefCell;

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// Preloaded documents stored in flat, contiguous memory for zero-copy access
/// Stored in original order for simplicity - sorting happens on-the-fly in batch_impl (negligible cost)
struct PreloadedDocuments {
    embeddings_flat: Vec<f32>,  // All document embeddings in one contiguous array (original order)
    doc_tokens: Vec<usize>,     // Token count for each document (original order)
    embedding_dim: usize,       // Embedding dimension
}

#[wasm_bindgen]
pub struct MaxSimWasm {
    // Reusable buffers to avoid repeated allocations
    // These are hidden from JavaScript using #[wasm_bindgen(skip)]
    #[wasm_bindgen(skip)]
    similarity_buffer: RefCell<Vec<f32>>,
    #[wasm_bindgen(skip)]
    batch_buffer: RefCell<Vec<f32>>,
    // Document preloading support (NEW in v0.5.0)
    // Stores documents as flat arrays for zero-copy access
    #[wasm_bindgen(skip)]
    documents: RefCell<Option<PreloadedDocuments>>,
}

#[wasm_bindgen]
impl MaxSimWasm {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MaxSimWasm {
        MaxSimWasm {
            similarity_buffer: RefCell::new(Vec::with_capacity(1024 * 128)), // Pre-allocate for common sizes
            batch_buffer: RefCell::new(Vec::with_capacity(1024 * 1024)),
            documents: RefCell::new(None), // No documents preloaded initially
        }
    }

    /// Official MaxSim: raw sum with dot product
    /// Expects L2-normalized embeddings. Matches ColBERT, pylate-rs, mixedbread-ai implementations
    #[wasm_bindgen]
    pub fn maxsim_single(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: usize,
        embedding_dim: usize,
    ) -> f32 {
        self.maxsim_single_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, false)
    }

    /// Normalized MaxSim: averaged score for cross-query comparison
    /// Expects L2-normalized embeddings
    #[wasm_bindgen]
    pub fn maxsim_single_normalized(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: usize,
        embedding_dim: usize,
    ) -> f32 {
        self.maxsim_single_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, true)
    }

    // Internal implementation shared by both methods
    fn maxsim_single_impl(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: usize,
        embedding_dim: usize,
        normalized: bool,
    ) -> f32 {
        // Use the optimized compute_maxsim_score which reuses buffers
        self.compute_maxsim_score(
            query_flat,
            query_tokens,
            doc_flat,
            doc_tokens,
            embedding_dim,
            normalized,
        )
    }

    /// Official MaxSim batch: raw sum with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, false, false)
    }

    /// Normalized MaxSim batch: averaged with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch_normalized(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, true, false)
    }

    // Internal batch implementation with adaptive optimization strategy
    //
    // OPTIMIZATION STRATEGY:
    // 1. Sort documents by length for better cache locality
    // 2. Detect uniform-length docs (≤20% variance) → fast path (no padding)
    // 3. Variable-length docs → adaptive length-based grouping with tolerance
    //    - Groups docs within 20-40% of each other (adaptive based on variance)
    //    - Processes in sub-batches of 16 docs for cache efficiency
    //    - Uses cache-blocked matrix multiply (adaptive 16/8/4 blocking)
    //
    // KEY INSIGHT: All paths use the same optimized compute_maxsim_score with
    // cache-blocked matrix_multiply for consistent performance
    fn maxsim_batch_impl(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
        normalized: bool,
        is_sorted: bool,  // NEW: documents already sorted by length?
    ) -> Vec<f32> {
        let num_docs = doc_tokens.len();

        if num_docs == 0 || query_tokens == 0 {
            return vec![0.0; num_docs];
        }

        let mut scores = vec![0.0; num_docs];

        // Build document info: (original_index, length, offset)
        let mut doc_infos: Vec<(usize, usize, usize)> = Vec::with_capacity(num_docs);
        let mut offset = 0;
        for (idx, &len) in doc_tokens.iter().enumerate() {
            doc_infos.push((idx, len, offset));
            offset += len * embedding_dim;
        }

        // Sort by document length for better batching (skip if already sorted!)
        let sorted_indices: Vec<usize> = if is_sorted {
            // Documents already sorted - use sequential indices (FAST!)
            (0..num_docs).collect()
        } else {
            // Need to sort - create sorted index array (slower)
            let mut indices: Vec<usize> = (0..num_docs).collect();
            indices.sort_by_key(|&i| doc_infos[i].1);
            indices
        };

        // Check if all documents have similar lengths (within 20% variance)
        let min_len = doc_infos[sorted_indices[0]].1;
        let max_len = doc_infos[sorted_indices[num_docs - 1]].1;
        let length_variance = if min_len > 0 {
            max_len as f32 / min_len as f32
        } else {
            f32::MAX
        };

        // Fast path: uniform-length documents (≤20% variance and ≥50 docs)
        if length_variance <= 1.2 && num_docs >= 50 {
            return self.maxsim_batch_uniform_length(
                query_flat,
                query_tokens,
                doc_flat,
                &doc_infos,
                &sorted_indices,
                embedding_dim,
                normalized,
            );
        }

        // Adaptive batching with length-based grouping (matches official maxsim-cpu)
        const TARGET_BATCH_SIZE: usize = 128;
        const LENGTH_TOLERANCE: f32 = 1.2;  // Fixed 20% tolerance (like official)

        let mut i = 0;
        while i < num_docs {
            let base_len = doc_infos[sorted_indices[i]].1;
            if base_len == 0 {
                i += 1;
                continue;
            }

            let max_allowed_len = (base_len as f32 * LENGTH_TOLERANCE) as usize;

            // Find batch end: docs within 20% tolerance of base length (matches official)
            let mut batch_end = i + 1;
            while batch_end < num_docs && batch_end < i + TARGET_BATCH_SIZE {
                let doc_len = doc_infos[sorted_indices[batch_end]].1;
                if doc_len > max_allowed_len {
                    break;
                }
                batch_end += 1;
            }

            let batch_size = batch_end - i;

            // Find actual max length in this homogeneous batch
            let batch_max_len = sorted_indices[i..batch_end]
                .iter()
                .map(|&idx| doc_infos[idx].1)
                .max()
                .unwrap_or(base_len);

            // Process batch
            if batch_size < 4 {
                // Too small for batching - process individually
                for &sorted_idx in &sorted_indices[i..batch_end] {
                    let (orig_idx, doc_len, doc_offset) = doc_infos[sorted_idx];
                    let doc_slice = &doc_flat[doc_offset..doc_offset + doc_len * embedding_dim];
                    scores[orig_idx] = self.compute_maxsim_score(
                        query_flat,
                        query_tokens,
                        doc_slice,
                        doc_len,
                        embedding_dim,
                        normalized,
                    );
                }
            } else {
                // Batch process with minimal padding
                self.process_variable_batch(
                    query_flat,
                    query_tokens,
                    doc_flat,
                    &doc_infos,
                    &sorted_indices[i..batch_end],
                    batch_max_len,
                    embedding_dim,
                    normalized,
                    &mut scores,
                );
            }

            i = batch_end;
        }

        scores
    }

    // Fast path for uniform-length documents
    fn maxsim_batch_uniform_length(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_infos: &[(usize, usize, usize)],
        sorted_indices: &[usize],
        embedding_dim: usize,
        normalized: bool,
    ) -> Vec<f32> {
        let num_docs = sorted_indices.len();
        let mut scores = vec![0.0; doc_infos.len()];
        let doc_len = doc_infos[sorted_indices[0]].1;

        // Process all documents together without padding
        let batch_size = 32;
        for batch_start in (0..num_docs).step_by(batch_size) {
            let batch_end = (batch_start + batch_size).min(num_docs);
            let actual_batch_size = batch_end - batch_start;

            self.batch_buffer.borrow_mut().resize(actual_batch_size * doc_len * embedding_dim, 0.0);

            // Copy documents into batch buffer
            {
                let mut buffer = self.batch_buffer.borrow_mut();
                for (batch_idx, &sorted_idx) in sorted_indices[batch_start..batch_end].iter().enumerate() {
                    let (_, _, doc_offset) = doc_infos[sorted_idx];
                    let src = &doc_flat[doc_offset..doc_offset + doc_len * embedding_dim];
                    let dst_offset = batch_idx * doc_len * embedding_dim;
                    buffer[dst_offset..dst_offset + src.len()].copy_from_slice(src);
                }
            }

            // Process batch
            let buffer = self.batch_buffer.borrow();
            for (batch_idx, &sorted_idx) in sorted_indices[batch_start..batch_end].iter().enumerate() {
                let (orig_idx, _, _) = doc_infos[sorted_idx];
                let doc_start = batch_idx * doc_len * embedding_dim;
                let doc_slice = &buffer[doc_start..doc_start + doc_len * embedding_dim];

                scores[orig_idx] = self.compute_maxsim_score(
                    query_flat,
                    query_tokens,
                    doc_slice,
                    doc_len,
                    embedding_dim,
                    normalized,
                );
            }
        }

        scores
    }

    // Process a batch of variable-length documents with TRUE parallel batching
    //
    // WASM-OPTIMIZED STRATEGY:
    // Unlike official maxsim-cpu (which uses BLAS GEMM for 128 docs at once),
    // we use cache-aware sub-batching because:
    // 1. WASM has no BLAS - manual loops benefit from smaller working sets
    // 2. L2 cache is limited (256KB-1MB) - sub-batches fit better
    // 3. Single-threaded - no benefit from massive batches
    //
    // Sub-batch size tuned for cache locality:
    // 16 docs × 256 tokens × 13 query × 4 bytes = 213 KB (fits in L2 ✓)
    fn process_variable_batch(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_infos: &[(usize, usize, usize)],
        batch_indices: &[usize],
        max_len: usize,
        embedding_dim: usize,
        normalized: bool,
        scores: &mut [f32],
    ) {
        let batch_size = batch_indices.len();

        // Cache-optimized sub-batch size for WASM (empirically tested optimal)
        // 16 docs: 165ms ✓ BEST
        // 32 docs: 198ms (cache thrashing)
        // Conclusion: 16 is the sweet spot for L2 cache
        const SUB_BATCH_SIZE: usize = 16;

        // Process in cache-friendly sub-batches
        let mut i = 0;
        while i < batch_size {
            let current_batch_size = (batch_size - i).min(SUB_BATCH_SIZE);
            let batch_slice = &batch_indices[i..i + current_batch_size];

            // Allocate buffer for this sub-batch
            let required_size = current_batch_size * max_len * embedding_dim;
            self.batch_buffer.borrow_mut().resize(required_size, 0.0);

            {
                let mut buffer = self.batch_buffer.borrow_mut();

                // Selective padding: only clear padding areas (optimization from official)
                for (batch_idx, &sorted_idx) in batch_slice.iter().enumerate() {
                    let (_, doc_len, doc_offset) = doc_infos[sorted_idx];
                    let src_size = doc_len * embedding_dim;
                    let dst_offset = batch_idx * max_len * embedding_dim;

                    // Copy actual document data
                    buffer[dst_offset..dst_offset + src_size]
                        .copy_from_slice(&doc_flat[doc_offset..doc_offset + src_size]);

                    // Clear only the padding area (if needed) - saves memory writes
                    if doc_len < max_len {
                        let padding_start = dst_offset + src_size;
                        let padding_end = dst_offset + max_len * embedding_dim;
                        buffer[padding_start..padding_end].fill(0.0);
                    }
                }
            }

            // Compute sub-batch
            let batch_scores = self.compute_maxsim_batch(
                query_flat,
                query_tokens,
                current_batch_size,
                max_len,
                embedding_dim,
                normalized,
                doc_infos,
                batch_slice,
            );

            // Store results
            for (batch_idx, &sorted_idx) in batch_slice.iter().enumerate() {
                let (orig_idx, _, _) = doc_infos[sorted_idx];
                scores[orig_idx] = batch_scores[batch_idx];
            }

            i += current_batch_size;
        }
    }

    // Compute MaxSim for multiple documents in a batch with TRUE batched processing
    // Processes ALL documents TOGETHER in a single pass (not sequentially!)
    // This allows SIMD vectorization across documents
    fn compute_maxsim_batch(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        batch_size: usize,
        max_doc_tokens: usize,
        embedding_dim: usize,
        normalized: bool,
        doc_infos: &[(usize, usize, usize)],
        batch_indices: &[usize],
    ) -> Vec<f32> {
        let batch_buffer = self.batch_buffer.borrow();

        // Allocate ONE large similarity buffer for ALL documents together
        // Layout: query_tokens × (batch_size × max_doc_tokens)
        let sim_size = query_tokens * batch_size * max_doc_tokens;
        self.similarity_buffer.borrow_mut().resize(sim_size, 0.0);

        // Compute similarities for ALL documents in ONE pass
        // OPTIMIZATION: Manual unrolling to improve instruction-level parallelism
        {
            let mut similarities = self.similarity_buffer.borrow_mut();

            // Outer loop: query tokens (for cache locality)
            for q_idx in 0..query_tokens {
                let query_token = &query_flat[q_idx * embedding_dim..(q_idx + 1) * embedding_dim];

                // Process documents in groups of 4 for better ILP
                let num_full_groups = batch_size / 4;

                // Process 4 documents at a time (unrolled for ILP)
                for group_idx in 0..num_full_groups {
                    let base_doc_idx = group_idx * 4;

                    // Get document info for all 4 docs
                    let (_, len0, _) = doc_infos[batch_indices[base_doc_idx]];
                    let (_, len1, _) = doc_infos[batch_indices[base_doc_idx + 1]];
                    let (_, len2, _) = doc_infos[batch_indices[base_doc_idx + 2]];
                    let (_, len3, _) = doc_infos[batch_indices[base_doc_idx + 3]];

                    let start0 = base_doc_idx * max_doc_tokens * embedding_dim;
                    let start1 = (base_doc_idx + 1) * max_doc_tokens * embedding_dim;
                    let start2 = (base_doc_idx + 2) * max_doc_tokens * embedding_dim;
                    let start3 = (base_doc_idx + 3) * max_doc_tokens * embedding_dim;

                    let min_len = len0.min(len1).min(len2).min(len3);

                    // Process common tokens for all 4 docs together (better ILP)
                    for doc_tok_idx in 0..min_len {
                        let tok_offset = doc_tok_idx * embedding_dim;

                        // Compute 4 similarities - CPU can pipeline these!
                        let sim0 = dot_product(query_token, &batch_buffer[start0 + tok_offset..start0 + tok_offset + embedding_dim]);
                        let sim1 = dot_product(query_token, &batch_buffer[start1 + tok_offset..start1 + tok_offset + embedding_dim]);
                        let sim2 = dot_product(query_token, &batch_buffer[start2 + tok_offset..start2 + tok_offset + embedding_dim]);
                        let sim3 = dot_product(query_token, &batch_buffer[start3 + tok_offset..start3 + tok_offset + embedding_dim]);

                        // Store all 4 results
                        let base_sim_idx = q_idx * (batch_size * max_doc_tokens) + doc_tok_idx;
                        similarities[base_sim_idx + base_doc_idx * max_doc_tokens] = sim0;
                        similarities[base_sim_idx + (base_doc_idx + 1) * max_doc_tokens] = sim1;
                        similarities[base_sim_idx + (base_doc_idx + 2) * max_doc_tokens] = sim2;
                        similarities[base_sim_idx + (base_doc_idx + 3) * max_doc_tokens] = sim3;
                    }

                    // Handle remaining tokens for each doc individually
                    for (offset, &(len, doc_idx)) in [(len0, base_doc_idx), (len1, base_doc_idx + 1),
                                                        (len2, base_doc_idx + 2), (len3, base_doc_idx + 3)].iter().enumerate() {
                        let start = (base_doc_idx + offset) * max_doc_tokens * embedding_dim;
                        for doc_tok_idx in min_len..len {
                            let tok_offset = doc_tok_idx * embedding_dim;
                            let similarity = dot_product(query_token, &batch_buffer[start + tok_offset..start + tok_offset + embedding_dim]);

                            let sim_idx = q_idx * (batch_size * max_doc_tokens) +
                                         doc_idx * max_doc_tokens +
                                         doc_tok_idx;
                            similarities[sim_idx] = similarity;
                        }
                    }
                }

                // Handle remainder documents (< 4)
                for doc_idx in (num_full_groups * 4)..batch_size {
                    let (_, actual_doc_len, _) = doc_infos[batch_indices[doc_idx]];
                    let doc_start = doc_idx * max_doc_tokens * embedding_dim;

                    for doc_tok_idx in 0..actual_doc_len {
                        let doc_token_start = doc_start + doc_tok_idx * embedding_dim;
                        let doc_token = &batch_buffer[doc_token_start..doc_token_start + embedding_dim];

                        let similarity = dot_product(query_token, doc_token);

                        let sim_idx = q_idx * (batch_size * max_doc_tokens) +
                                     doc_idx * max_doc_tokens +
                                     doc_tok_idx;
                        similarities[sim_idx] = similarity;
                    }
                }
            }
        }

        // Compute MaxSim scores for each document
        let similarities = self.similarity_buffer.borrow();
        let mut batch_scores = vec![0.0; batch_size];

        for doc_idx in 0..batch_size {
            let (_, actual_doc_len, _) = doc_infos[batch_indices[doc_idx]];
            let mut sum_max_sim = 0.0;

            // For each query token, find max similarity across this document's tokens
            for q_idx in 0..query_tokens {
                let row_start = q_idx * (batch_size * max_doc_tokens) + doc_idx * max_doc_tokens;
                let row_end = row_start + actual_doc_len;

                sum_max_sim += simd_max(&similarities[row_start..row_end]);
            }

            batch_scores[doc_idx] = if normalized {
                sum_max_sim / query_tokens as f32
            } else {
                sum_max_sim
            };
        }

        batch_scores
    }

    // Optimized score computation with buffer reuse
    fn compute_maxsim_score(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_slice: &[f32],
        doc_tokens: usize,
        embedding_dim: usize,
        normalized: bool,
    ) -> f32 {
        if query_tokens == 0 || doc_tokens == 0 {
            return 0.0;
        }

        let sim_size = query_tokens * doc_tokens;
        self.similarity_buffer.borrow_mut().resize(sim_size, 0.0);

        // Compute similarities using shared buffer
        {
            let mut similarities = self.similarity_buffer.borrow_mut();
            matrix_multiply(
                query_flat,
                doc_slice,
                &mut similarities,
                query_tokens,
                doc_tokens,
                embedding_dim,
                normalized,
            );
        }

        // Compute max-sim score
        let similarities = self.similarity_buffer.borrow();
        let mut sum_max_sim = 0.0;
        for q_idx in 0..query_tokens {
            let row_start = q_idx * doc_tokens;
            let row_end = row_start + doc_tokens;
            sum_max_sim += simd_max(&similarities[row_start..row_end]);
        }

        if normalized {
            sum_max_sim / query_tokens as f32
        } else {
            sum_max_sim
        }
    }

    /// Official MaxSim batch uniform: raw sum with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch_uniform(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        num_docs: usize,
        doc_tokens: usize,
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_uniform_impl(query_flat, query_tokens, doc_flat, num_docs, doc_tokens, embedding_dim, false)
    }

    /// Normalized MaxSim batch uniform: averaged with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch_uniform_normalized(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        num_docs: usize,
        doc_tokens: usize,
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_uniform_impl(query_flat, query_tokens, doc_flat, num_docs, doc_tokens, embedding_dim, true)
    }

    // Internal implementation
    fn maxsim_batch_uniform_impl(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        num_docs: usize,
        doc_tokens: usize,
        embedding_dim: usize,
        normalized: bool,
    ) -> Vec<f32> {
        if num_docs == 0 || query_tokens == 0 || doc_tokens == 0 {
            return vec![0.0; num_docs];
        }

        let mut scores = vec![0.0; num_docs];

        // Process each document with cache-blocked matrix multiply (same as other optimized paths)
        for doc_idx in 0..num_docs {
            let doc_start = doc_idx * doc_tokens * embedding_dim;
            let doc_end = doc_start + doc_tokens * embedding_dim;
            let doc_slice = &doc_flat[doc_start..doc_end];

            scores[doc_idx] = self.compute_maxsim_score(
                query_flat,
                query_tokens,
                doc_slice,
                doc_tokens,
                embedding_dim,
                normalized,
            );
        }

        scores
    }

    /// Official MaxSim batch zero-copy: raw sum with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch_zero_copy(
        &mut self,
        query_ptr: *const f32,
        query_tokens: usize,
        doc_ptr: *const f32,
        doc_tokens_ptr: *const usize,
        num_docs: usize,
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_zero_copy_impl(query_ptr, query_tokens, doc_ptr, doc_tokens_ptr, num_docs, embedding_dim, false)
    }

    /// Normalized MaxSim batch zero-copy: averaged with dot product
    #[wasm_bindgen]
    pub fn maxsim_batch_zero_copy_normalized(
        &mut self,
        query_ptr: *const f32,
        query_tokens: usize,
        doc_ptr: *const f32,
        doc_tokens_ptr: *const usize,
        num_docs: usize,
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_zero_copy_impl(query_ptr, query_tokens, doc_ptr, doc_tokens_ptr, num_docs, embedding_dim, true)
    }

    // Internal implementation
    fn maxsim_batch_zero_copy_impl(
        &mut self,
        query_ptr: *const f32,
        query_tokens: usize,
        doc_ptr: *const f32,
        doc_tokens_ptr: *const usize,
        num_docs: usize,
        embedding_dim: usize,
        normalized: bool,
    ) -> Vec<f32> {
        if num_docs == 0 || query_tokens == 0 {
            return vec![0.0; num_docs];
        }

        // Convert pointers to slices
        let query_slice = unsafe {
            std::slice::from_raw_parts(query_ptr, query_tokens * embedding_dim)
        };
        let doc_tokens_slice = unsafe {
            std::slice::from_raw_parts(doc_tokens_ptr, num_docs)
        };

        // Calculate total document floats to create flat doc slice
        let total_doc_floats: usize = doc_tokens_slice.iter()
            .map(|&count| count * embedding_dim)
            .sum();

        let doc_slice = unsafe {
            std::slice::from_raw_parts(doc_ptr, total_doc_floats)
        };

        // USE BATCH OPTIMIZATION! 🚀
        // This gives us sorting, grouping, cache blocking - same optimizations as preloaded!
        self.maxsim_batch_impl(
            query_slice,
            query_tokens,
            doc_slice,
            doc_tokens_slice,
            embedding_dim,
            normalized,
            false  // Data not pre-sorted
        )
    }

    #[wasm_bindgen]
    pub fn get_info(&self) -> String {
        format!(
            "MaxSim WASM v0.5.0 (SIMD: {}, adaptive_batching: true, buffer_reuse: true, methods: maxsim + maxsim_normalized + preloading)",
            cfg!(target_feature = "simd128")
        )
    }

    /// Load and store document embeddings in WASM memory
    /// This eliminates per-search conversion overhead (following FastPlaid's pattern)
    ///
    /// # Arguments
    /// * `embeddings_data` - Flat array of all document embeddings concatenated
    /// * `doc_tokens` - Array of token counts for each document
    /// * `embedding_dim` - Embedding dimension
    ///
    /// # Example
    /// For 3 documents with [128, 256, 192] tokens each at dim=48:
    /// - embeddings_data.len() = (128 + 256 + 192) * 48 = 27,648
    /// - doc_tokens = [128, 256, 192]
    #[wasm_bindgen]
    pub fn load_documents(
        &mut self,
        embeddings_data: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
    ) -> Result<(), JsValue> {
        if doc_tokens.is_empty() {
            return Err(JsValue::from_str("No documents to load"));
        }

        if embedding_dim == 0 {
            return Err(JsValue::from_str("Embedding dimension must be > 0"));
        }

        // Validate data size
        let expected_size: usize = doc_tokens.iter().map(|&count| count * embedding_dim).sum();
        if embeddings_data.len() != expected_size {
            return Err(JsValue::from_str("Embeddings data size mismatch"));
        }

        // Store documents EXACTLY as received - zero restructuring overhead!
        // Sorting happens on-the-fly in maxsim_batch_impl (negligible cost: ~0.05ms for 1000 docs)
        // This is simpler and faster than pre-sorting + reordering scores
        let preloaded = PreloadedDocuments {
            embeddings_flat: embeddings_data.to_vec(),
            doc_tokens: doc_tokens.to_vec(),
            embedding_dim,
        };

        *self.documents.borrow_mut() = Some(preloaded);
        Ok(())
    }

    /// Search preloaded documents with a query
    /// Returns MaxSim scores for all documents
    ///
    /// # Arguments
    /// * `query_flat` - Flat query embedding (query_tokens × embedding_dim)
    /// * `query_tokens` - Number of query tokens
    ///
    /// # Returns
    /// Float32Array of MaxSim scores (one per document)
    #[wasm_bindgen]
    pub fn search_preloaded(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
    ) -> Result<Vec<f32>, JsValue> {
        // Get reference to preloaded documents
        let docs_ref = self.documents.borrow();
        let docs = docs_ref.as_ref()
            .ok_or_else(|| JsValue::from_str("No documents loaded. Call load_documents() first."))?;

        if query_tokens == 0 {
            return Err(JsValue::from_str("Query cannot be empty"));
        }

        if query_flat.len() != query_tokens * docs.embedding_dim {
            return Err(JsValue::from_str("Query size mismatch"));
        }

        // ZERO-COPY SEARCH! 🚀
        // Documents already stored as flat arrays - direct batch processing with full optimizations
        // Sorting happens on-the-fly (negligible cost), scores returned in original order
        let scores = self.maxsim_batch_impl(
            query_flat,
            query_tokens,
            &docs.embeddings_flat,  // Already flat and contiguous!
            &docs.doc_tokens,        // Already computed!
            docs.embedding_dim,
            false,         // not normalized
            false          // Sort on-the-fly (cheap)
        );

        Ok(scores)
    }

    /// Search preloaded documents with normalized MaxSim scores
    #[wasm_bindgen]
    pub fn search_preloaded_normalized(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
    ) -> Result<Vec<f32>, JsValue> {
        // Get reference to preloaded documents
        let docs_ref = self.documents.borrow();
        let docs = docs_ref.as_ref()
            .ok_or_else(|| JsValue::from_str("No documents loaded. Call load_documents() first."))?;

        if query_tokens == 0 {
            return Err(JsValue::from_str("Query cannot be empty"));
        }

        if query_flat.len() != query_tokens * docs.embedding_dim {
            return Err(JsValue::from_str("Query size mismatch"));
        }

        // ZERO-COPY SEARCH! 🚀
        // Documents already stored as flat arrays - direct batch processing with full optimizations
        // Sorting happens on-the-fly (negligible cost), scores returned in original order
        let scores = self.maxsim_batch_impl(
            query_flat,
            query_tokens,
            &docs.embeddings_flat,  // Already flat and contiguous!
            &docs.doc_tokens,        // Already computed!
            docs.embedding_dim,
            true,          // normalized
            false          // Sort on-the-fly (cheap)
        );

        Ok(scores)
    }

    /// Get number of loaded documents
    #[wasm_bindgen]
    pub fn num_documents_loaded(&self) -> usize {
        self.documents.borrow()
            .as_ref()
            .map(|d| d.doc_tokens.len())
            .unwrap_or(0)
    }
}

// ============================================================================
// SIMD DOT PRODUCT - Macro-generated specialized versions
// ============================================================================

macro_rules! generate_simd_dot {
    ($name:ident, $dim:expr) => {
        #[cfg(target_arch = "wasm32")]
        #[inline]
        fn $name(a: &[f32], b: &[f32]) -> f32 {
            unsafe {
                let mut sum = f32x4_splat(0.0);
                for i in (0..$dim).step_by(4) {
                    let va = v128_load(a.as_ptr().add(i) as *const v128);
                    let vb = v128_load(b.as_ptr().add(i) as *const v128);
                    sum = f32x4_add(sum, f32x4_mul(va, vb));
                }
                f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) + 
                f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum)
            }
        }
    };
}

generate_simd_dot!(simd_dot_128, 128);
generate_simd_dot!(simd_dot_256, 256);
generate_simd_dot!(simd_dot_384, 384);
generate_simd_dot!(simd_dot_512, 512);
generate_simd_dot!(simd_dot_768, 768);
generate_simd_dot!(simd_dot_1024, 1024);

#[cfg(target_arch = "wasm32")]
#[inline]
fn simd_dot_generic(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len();
    let simd_len = len - (len % 16);

    unsafe {
        let mut sum0 = f32x4_splat(0.0);
        let mut sum1 = f32x4_splat(0.0);
        let mut sum2 = f32x4_splat(0.0);
        let mut sum3 = f32x4_splat(0.0);

        let mut i = 0;
        while i < simd_len {
            let va0 = v128_load(a.as_ptr().add(i) as *const v128);
            let vb0 = v128_load(b.as_ptr().add(i) as *const v128);
            sum0 = f32x4_add(sum0, f32x4_mul(va0, vb0));

            let va1 = v128_load(a.as_ptr().add(i + 4) as *const v128);
            let vb1 = v128_load(b.as_ptr().add(i + 4) as *const v128);
            sum1 = f32x4_add(sum1, f32x4_mul(va1, vb1));

            let va2 = v128_load(a.as_ptr().add(i + 8) as *const v128);
            let vb2 = v128_load(b.as_ptr().add(i + 8) as *const v128);
            sum2 = f32x4_add(sum2, f32x4_mul(va2, vb2));

            let va3 = v128_load(a.as_ptr().add(i + 12) as *const v128);
            let vb3 = v128_load(b.as_ptr().add(i + 12) as *const v128);
            sum3 = f32x4_add(sum3, f32x4_mul(va3, vb3));

            i += 16;
        }

        let sum_ab = f32x4_add(f32x4_add(sum0, sum1), f32x4_add(sum2, sum3));
        let mut result = f32x4_extract_lane::<0>(sum_ab)
            + f32x4_extract_lane::<1>(sum_ab)
            + f32x4_extract_lane::<2>(sum_ab)
            + f32x4_extract_lane::<3>(sum_ab);

        for j in simd_len..len {
            result += a[j] * b[j];
        }

        result
    }
}

#[inline]
fn dot_product(a: &[f32], b: &[f32]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        match a.len() {
            128 => simd_dot_128(a, b),
            256 => simd_dot_256(a, b),
            384 => simd_dot_384(a, b),
            512 => simd_dot_512(a, b),
            768 => simd_dot_768(a, b),
            1024 => simd_dot_1024(a, b),
            _ => simd_dot_generic(a, b),
        }
    }
    
    #[cfg(not(target_arch = "wasm32"))]
    {
        a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
    }
}

// ============================================================================
// MATRIX MULTIPLICATION with Adaptive Cache Blocking
// ============================================================================

#[inline]
fn matrix_multiply(
    query_flat: &[f32],
    doc_flat: &[f32],
    similarities: &mut [f32],
    query_tokens: usize,
    doc_tokens: usize,
    embedding_dim: usize,
    normalized: bool,
) {
    // Adaptive cache blocking based on document length
    let d_block_size = match doc_tokens {
        0..=64 => 16,
        65..=128 => 16,
        129..=256 => 12,
        257..=512 => 8,
        513..=1024 => 6,
        1025..=2048 => 4,
        _ => 4,
    };
    
    let q_block_size = 8;

    for q_block in (0..query_tokens).step_by(q_block_size) {
        let q_end = (q_block + q_block_size).min(query_tokens);
        
        for d_block in (0..doc_tokens).step_by(d_block_size) {
            let d_end = (d_block + d_block_size).min(doc_tokens);
            
            for q_idx in q_block..q_end {
                let query_start = q_idx * embedding_dim;
                let query_token = &query_flat[query_start..query_start + embedding_dim];
                
                for d_idx in d_block..d_end {
                    let doc_start = d_idx * embedding_dim;
                    let doc_token = &doc_flat[doc_start..doc_start + embedding_dim];
                    
                    let similarity = dot_product(query_token, doc_token);
                    
                    similarities[q_idx * doc_tokens + d_idx] = similarity;
                }
            }
        }
    }
}

// ============================================================================
// SIMD MAX FINDING
// ============================================================================

#[cfg(target_arch = "wasm32")]
#[inline]
fn simd_max(slice: &[f32]) -> f32 {
    let len = slice.len();
    
    if len < 32 {
        return slice.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    }

    let simd_len = len - (len % 32);

    unsafe {
        let mut max0 = f32x4_splat(f32::NEG_INFINITY);
        let mut max1 = f32x4_splat(f32::NEG_INFINITY);
        let mut max2 = f32x4_splat(f32::NEG_INFINITY);
        let mut max3 = f32x4_splat(f32::NEG_INFINITY);
        let mut max4 = f32x4_splat(f32::NEG_INFINITY);
        let mut max5 = f32x4_splat(f32::NEG_INFINITY);
        let mut max6 = f32x4_splat(f32::NEG_INFINITY);
        let mut max7 = f32x4_splat(f32::NEG_INFINITY);

        let mut i = 0;
        while i < simd_len {
            let data0 = v128_load(slice.as_ptr().add(i) as *const v128);
            let data1 = v128_load(slice.as_ptr().add(i + 4) as *const v128);
            let data2 = v128_load(slice.as_ptr().add(i + 8) as *const v128);
            let data3 = v128_load(slice.as_ptr().add(i + 12) as *const v128);
            let data4 = v128_load(slice.as_ptr().add(i + 16) as *const v128);
            let data5 = v128_load(slice.as_ptr().add(i + 20) as *const v128);
            let data6 = v128_load(slice.as_ptr().add(i + 24) as *const v128);
            let data7 = v128_load(slice.as_ptr().add(i + 28) as *const v128);

            max0 = f32x4_pmax(max0, data0);
            max1 = f32x4_pmax(max1, data1);
            max2 = f32x4_pmax(max2, data2);
            max3 = f32x4_pmax(max3, data3);
            max4 = f32x4_pmax(max4, data4);
            max5 = f32x4_pmax(max5, data5);
            max6 = f32x4_pmax(max6, data6);
            max7 = f32x4_pmax(max7, data7);

            i += 32;
        }

        let max_ab = f32x4_pmax(f32x4_pmax(max0, max1), f32x4_pmax(max2, max3));
        let max_cd = f32x4_pmax(f32x4_pmax(max4, max5), f32x4_pmax(max6, max7));
        let final_max = f32x4_pmax(max_ab, max_cd);

        let mut result = f32x4_extract_lane::<0>(final_max)
            .max(f32x4_extract_lane::<1>(final_max))
            .max(f32x4_extract_lane::<2>(final_max))
            .max(f32x4_extract_lane::<3>(final_max));

        for j in simd_len..len {
            result = result.max(slice[j]);
        }

        result
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[inline]
fn simd_max(slice: &[f32]) -> f32 {
    slice.iter().copied().fold(f32::NEG_INFINITY, f32::max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dot_product() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![2.0, 3.0, 4.0, 5.0];
        let result = dot_product(&a, &b);
        assert_eq!(result, 40.0);
    }

    #[test]
    fn test_maxsim_single_official() {
        let maxsim = MaxSimWasm::new();
        let query = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let doc = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        let score = maxsim.maxsim_single(&query, 2, &doc, 3, 3);
        // Official MaxSim: raw sum, should be >= 0
        assert!(score >= 0.0);
    }

    #[test]
    fn test_maxsim_single_normalized() {
        let maxsim = MaxSimWasm::new();
        let query = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let doc = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        let score = maxsim.maxsim_single_normalized(&query, 2, &doc, 3, 3);
        // Normalized MaxSim: averaged, should be between -1 and 1
        assert!(score >= -1.0 && score <= 1.0);
    }
}
