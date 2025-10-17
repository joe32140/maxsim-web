/*!
 * MaxSim CPU - WASM Implementation with SIMD
 *
 * This module provides a high-performance WebAssembly implementation of the MaxSim
 * algorithm using SIMD (Single Instruction, Multiple Data) instructions.
 *
 * Expected performance: 10x faster than pure JavaScript baseline.
 */

use wasm_bindgen::prelude::*;

// Import WASM SIMD intrinsics when targeting wasm32
#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// MaxSim implementation with WASM and SIMD optimizations
#[wasm_bindgen]
pub struct MaxSimWasm {
    normalized: bool,
}

#[wasm_bindgen]
impl MaxSimWasm {
    /// Create a new MaxSimWasm instance
    ///
    /// # Arguments
    /// * `normalized` - Whether embeddings are pre-normalized (L2 norm = 1)
    #[wasm_bindgen(constructor)]
    pub fn new(normalized: bool) -> MaxSimWasm {
        MaxSimWasm { normalized }
    }

    /// Compute MaxSim score for a single query-document pair
    ///
    /// # Arguments
    /// * `query_flat` - Flattened query embeddings [token0_dim0, token0_dim1, ..., token1_dim0, ...]
    /// * `query_tokens` - Number of query tokens
    /// * `doc_flat` - Flattened document embeddings
    /// * `doc_tokens` - Number of document tokens
    /// * `embedding_dim` - Embedding dimension (e.g., 128)
    ///
    /// # Returns
    /// MaxSim score (average of max similarities per query token)
    #[wasm_bindgen]
    pub fn maxsim_single(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: usize,
        embedding_dim: usize,
    ) -> f32 {
        if query_tokens == 0 || doc_tokens == 0 {
            return 0.0;
        }

        let mut sum_max_sim = 0.0;

        // For each query token
        for q_idx in 0..query_tokens {
            let query_start = q_idx * embedding_dim;
            let query_token = &query_flat[query_start..query_start + embedding_dim];

            let mut max_sim = f32::NEG_INFINITY;

            // Find max similarity with any document token
            for d_idx in 0..doc_tokens {
                let doc_start = d_idx * embedding_dim;
                let doc_token = &doc_flat[doc_start..doc_start + embedding_dim];

                let similarity = if self.normalized {
                    dot_product_simd(query_token, doc_token)
                } else {
                    cosine_similarity_simd(query_token, doc_token)
                };

                if similarity > max_sim {
                    max_sim = similarity;
                }
            }

            sum_max_sim += max_sim;
        }

        sum_max_sim / query_tokens as f32
    }

    /// Compute MaxSim scores for multiple documents (batch processing)
    ///
    /// # Arguments
    /// * `query_flat` - Flattened query embeddings
    /// * `query_tokens` - Number of query tokens
    /// * `doc_flat` - Flattened document embeddings (all docs concatenated)
    /// * `doc_tokens` - Array of token counts for each document
    /// * `embedding_dim` - Embedding dimension
    ///
    /// # Returns
    /// Array of MaxSim scores (one per document)
    #[wasm_bindgen]
    pub fn maxsim_batch(
        &self,
        query_flat: &[f32],
        query_tokens: usize,
        doc_flat: &[f32],
        doc_tokens: &[usize],
        embedding_dim: usize,
    ) -> Vec<f32> {
        let num_docs = doc_tokens.len();
        let mut scores = vec![0.0; num_docs];

        let mut doc_offset = 0;

        for (doc_idx, &num_tokens) in doc_tokens.iter().enumerate() {
            let doc_end = doc_offset + num_tokens * embedding_dim;
            let doc_slice = &doc_flat[doc_offset..doc_end];

            scores[doc_idx] = self.maxsim_single(
                query_flat,
                query_tokens,
                doc_slice,
                num_tokens,
                embedding_dim,
            );

            doc_offset = doc_end;
        }

        scores
    }

    /// Get information about this implementation
    #[wasm_bindgen]
    pub fn get_info(&self) -> String {
        format!(
            "MaxSim WASM v0.3.0 (normalized: {}, SIMD: {})",
            self.normalized,
            cfg!(target_feature = "simd128")
        )
    }
}

/// Dot product with SIMD optimization (for normalized vectors)
///
/// This is ~4x faster than scalar code on supported platforms.
#[inline]
fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        dot_product_simd_impl(a, b)
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        dot_product_scalar(a, b)
    }
}

/// SIMD implementation of dot product (WASM32 only)
#[cfg(target_arch = "wasm32")]
#[inline]
fn dot_product_simd_impl(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len();
    let simd_len = len - (len % 4);

    let mut sum_vec = f32x4_splat(0.0);

    // Process 4 elements at a time with SIMD
    let mut i = 0;
    while i < simd_len {
        unsafe {
            // Load 4 floats from each array
            let va = v128_load(a.as_ptr().add(i) as *const v128);
            let vb = v128_load(b.as_ptr().add(i) as *const v128);

            // Multiply and accumulate
            let prod = f32x4_mul(va, vb);
            sum_vec = f32x4_add(sum_vec, prod);
        }
        i += 4;
    }

    // Extract and sum the 4 elements from SIMD register
    let sum = f32x4_extract_lane::<0>(sum_vec)
        + f32x4_extract_lane::<1>(sum_vec)
        + f32x4_extract_lane::<2>(sum_vec)
        + f32x4_extract_lane::<3>(sum_vec);

    // Handle remaining elements (scalar)
    let mut remaining = sum;
    for j in simd_len..len {
        remaining += a[j] * b[j];
    }

    remaining
}

/// Scalar fallback for dot product
#[inline]
fn dot_product_scalar(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

/// Cosine similarity with SIMD optimization
#[inline]
fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        cosine_similarity_simd_impl(a, b)
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        cosine_similarity_scalar(a, b)
    }
}

/// SIMD implementation of cosine similarity (WASM32 only)
#[cfg(target_arch = "wasm32")]
#[inline]
fn cosine_similarity_simd_impl(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len();
    let simd_len = len - (len % 4);

    let mut dot_vec = f32x4_splat(0.0);
    let mut mag_a_vec = f32x4_splat(0.0);
    let mut mag_b_vec = f32x4_splat(0.0);

    // Process 4 elements at a time
    let mut i = 0;
    while i < simd_len {
        unsafe {
            let va = v128_load(a.as_ptr().add(i) as *const v128);
            let vb = v128_load(b.as_ptr().add(i) as *const v128);

            // Dot product
            let prod = f32x4_mul(va, vb);
            dot_vec = f32x4_add(dot_vec, prod);

            // Magnitudes
            let a_sq = f32x4_mul(va, va);
            let b_sq = f32x4_mul(vb, vb);
            mag_a_vec = f32x4_add(mag_a_vec, a_sq);
            mag_b_vec = f32x4_add(mag_b_vec, b_sq);
        }
        i += 4;
    }

    // Extract sums
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

    // Handle remaining elements
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

/// Scalar fallback for cosine similarity
#[inline]
fn cosine_similarity_scalar(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if mag_a == 0.0 || mag_b == 0.0 {
        return 0.0;
    }

    dot / (mag_a * mag_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dot_product() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![2.0, 3.0, 4.0, 5.0];
        let result = dot_product_simd(&a, &b);
        assert_eq!(result, 40.0); // 1*2 + 2*3 + 3*4 + 4*5
    }

    #[test]
    fn test_maxsim_single() {
        let maxsim = MaxSimWasm::new(true);

        // Query: 2 tokens, 3 dims each
        let query = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];

        // Doc: 3 tokens, 3 dims each
        let doc = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];

        let score = maxsim.maxsim_single(&query, 2, &doc, 3, 3);

        assert!(score > 0.0);
        assert!(score <= 1.0);
    }
}
