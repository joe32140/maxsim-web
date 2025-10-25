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

#[wasm_bindgen]
pub struct MaxSimWasm {
    // Reusable buffers to avoid repeated allocations
    // These are hidden from JavaScript using #[wasm_bindgen(skip)]
    #[wasm_bindgen(skip)]
    similarity_buffer: RefCell<Vec<f32>>,
    #[wasm_bindgen(skip)]
    batch_buffer: RefCell<Vec<f32>>,
}

#[wasm_bindgen]
impl MaxSimWasm {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MaxSimWasm {
        MaxSimWasm {
            similarity_buffer: RefCell::new(Vec::with_capacity(1024 * 128)), // Pre-allocate for common sizes
            batch_buffer: RefCell::new(Vec::with_capacity(1024 * 1024)),
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

    /// Official MaxSim batch: raw sum with cosine similarity
    #[wasm_bindgen]
    pub fn maxsim_batch(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
    ) -> Vec<f32> {
        self.maxsim_batch_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, false)
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
        self.maxsim_batch_impl(query_flat, query_tokens, doc_flat, doc_tokens, embedding_dim, true)
    }

    // Internal implementation with optimized batching
    fn maxsim_batch_impl(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
        normalized: bool,
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

        // Sort by document length for better batching
        let mut sorted_indices: Vec<usize> = (0..num_docs).collect();
        sorted_indices.sort_by_key(|&i| doc_infos[i].1);

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

        // Adaptive batching for variable-length documents
        const LARGE_BATCH_SIZE: usize = 32;
        const SMALL_BATCH_SIZE: usize = 16;

        let batch_size = if num_docs >= LARGE_BATCH_SIZE {
            LARGE_BATCH_SIZE
        } else {
            SMALL_BATCH_SIZE
        };

        // Process documents in batches
        let mut i = 0;
        while i < num_docs {
            let batch_end = (i + batch_size).min(num_docs);

            // Find max length in this batch
            let batch_max_len = sorted_indices[i..batch_end]
                .iter()
                .map(|&idx| doc_infos[idx].1)
                .max()
                .unwrap_or(0);

            if batch_max_len == 0 {
                i = batch_end;
                continue;
            }

            // Process batch with selective padding
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

    // Process a batch of variable-length documents with selective padding
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
        let required_size = batch_size * max_len * embedding_dim;

        self.batch_buffer.borrow_mut().resize(required_size, 0.0);

        // Copy documents with selective padding
        {
            let mut buffer = self.batch_buffer.borrow_mut();
            buffer.fill(0.0); // Zero out for padding

            for (batch_idx, &sorted_idx) in batch_indices.iter().enumerate() {
                let (_, doc_len, doc_offset) = doc_infos[sorted_idx];
                let src_size = doc_len * embedding_dim;
                let dst_offset = batch_idx * max_len * embedding_dim;

                // Copy document data
                buffer[dst_offset..dst_offset + src_size]
                    .copy_from_slice(&doc_flat[doc_offset..doc_offset + src_size]);

                // Padding is already zero from fill(0.0)
            }
        }

        // Compute scores for each document in batch
        let buffer = self.batch_buffer.borrow();
        for (batch_idx, &sorted_idx) in batch_indices.iter().enumerate() {
            let (orig_idx, doc_len, _) = doc_infos[sorted_idx];
            let doc_start = batch_idx * max_len * embedding_dim;
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

    /// Official MaxSim batch uniform: raw sum with cosine similarity
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
        let block_size = 8;

        for doc_block_start in (0..num_docs).step_by(block_size) {
            let doc_block_end = (doc_block_start + block_size).min(num_docs);
            let actual_block_size = doc_block_end - doc_block_start;

            let mut block_similarities = vec![0.0f32; query_tokens * actual_block_size * doc_tokens];

            for q_idx in 0..query_tokens {
                let query_start = q_idx * embedding_dim;
                let query_token = &query_flat[query_start..query_start + embedding_dim];

                for block_doc_idx in 0..actual_block_size {
                    let global_doc_idx = doc_block_start + block_doc_idx;
                    let doc_start = global_doc_idx * doc_tokens * embedding_dim;

                    for d_idx in 0..doc_tokens {
                        let doc_token_start = doc_start + d_idx * embedding_dim;
                        let doc_token = &doc_flat[doc_token_start..doc_token_start + embedding_dim];

                        let similarity = if normalized {
                            dot_product(query_token, doc_token)
                        } else {
                            cosine_similarity(query_token, doc_token)
                        };

                        let sim_idx = q_idx * (actual_block_size * doc_tokens) +
                                     block_doc_idx * doc_tokens + d_idx;
                        block_similarities[sim_idx] = similarity;
                    }
                }
            }

            for block_doc_idx in 0..actual_block_size {
                let global_doc_idx = doc_block_start + block_doc_idx;
                let mut sum_max_sim = 0.0;

                for q_idx in 0..query_tokens {
                    let row_start = q_idx * (actual_block_size * doc_tokens) +
                                   block_doc_idx * doc_tokens;
                    let row_end = row_start + doc_tokens;
                    sum_max_sim += simd_max(&block_similarities[row_start..row_end]);
                }

                // Official MaxSim = SUM (no averaging)
                // Normalized MaxSim = SUM / query_tokens (for cross-query comparison)
                scores[global_doc_idx] = if normalized {
                    sum_max_sim / query_tokens as f32
                } else {
                    sum_max_sim
                };
            }
        }

        scores
    }

    /// Official MaxSim batch zero-copy: raw sum with cosine similarity
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

        let query_slice = unsafe {
            std::slice::from_raw_parts(query_ptr, query_tokens * embedding_dim)
        };
        let doc_tokens_slice = unsafe {
            std::slice::from_raw_parts(doc_tokens_ptr, num_docs)
        };

        let mut scores = vec![0.0; num_docs];
        let mut doc_offset = 0;

        for (doc_idx, &doc_token_count) in doc_tokens_slice.iter().enumerate() {
            let doc_slice = unsafe {
                std::slice::from_raw_parts(
                    doc_ptr.add(doc_offset),
                    doc_token_count * embedding_dim
                )
            };

            scores[doc_idx] = self.maxsim_single_impl(
                query_slice,
                query_tokens,
                doc_slice,
                doc_token_count,
                embedding_dim,
                normalized,
            );

            doc_offset += doc_token_count * embedding_dim;
        }

        scores
    }

    #[wasm_bindgen]
    pub fn get_info(&self) -> String {
        format!(
            "MaxSim WASM v0.5.0 (SIMD: {}, adaptive_batching: true, buffer_reuse: true, methods: maxsim + maxsim_normalized)",
            cfg!(target_feature = "simd128")
        )
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
// COSINE SIMILARITY
// ============================================================================

#[cfg(target_arch = "wasm32")]
#[inline]
fn simd_cosine(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len();
    let simd_len = len - (len % 4);

    let mut dot_vec = f32x4_splat(0.0);
    let mut mag_a_vec = f32x4_splat(0.0);
    let mut mag_b_vec = f32x4_splat(0.0);

    unsafe {
        let mut i = 0;
        while i < simd_len {
            let va = v128_load(a.as_ptr().add(i) as *const v128);
            let vb = v128_load(b.as_ptr().add(i) as *const v128);

            dot_vec = f32x4_add(dot_vec, f32x4_mul(va, vb));
            mag_a_vec = f32x4_add(mag_a_vec, f32x4_mul(va, va));
            mag_b_vec = f32x4_add(mag_b_vec, f32x4_mul(vb, vb));
            i += 4;
        }

        let mut dot = f32x4_extract_lane::<0>(dot_vec)
            + f32x4_extract_lane::<1>(dot_vec)
            + f32x4_extract_lane::<2>(dot_vec)
            + f32x4_extract_lane::<3>(dot_vec);

        let mut mag_a = f32x4_extract_lane::<0>(mag_a_vec)
            + f32x4_extract_lane::<1>(mag_a_vec)
            + f32x4_extract_lane::<2>(mag_a_vec)
            + f32x4_extract_lane::<3>(mag_a_vec);

        let mut mag_b = f32x4_extract_lane::<0>(mag_b_vec)
            + f32x4_extract_lane::<1>(mag_b_vec)
            + f32x4_extract_lane::<2>(mag_b_vec)
            + f32x4_extract_lane::<3>(mag_b_vec);

        for j in simd_len..len {
            let av = a[j];
            let bv = b[j];
            dot += av * bv;
            mag_a += av * av;
            mag_b += bv * bv;
        }

        if mag_a == 0.0 || mag_b == 0.0 {
            return 0.0;
        }

        dot / (mag_a.sqrt() * mag_b.sqrt())
    }
}

#[inline]
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        simd_cosine(a, b)
    }
    
    #[cfg(not(target_arch = "wasm32"))]
    {
        let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        if mag_a == 0.0 || mag_b == 0.0 { 0.0 } else { dot / (mag_a * mag_b) }
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
                    
                    let similarity = if normalized {
                        dot_product(query_token, doc_token)
                    } else {
                        cosine_similarity(query_token, doc_token)
                    };
                    
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
