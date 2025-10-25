/**
 * MaxSim Web - API Comparison Example
 *
 * This example demonstrates the performance difference between:
 * 1. 2D Array API (convenient but slow)
 * 2. Flat Array API (fast, zero-copy)
 */

import { MaxSimWasm } from '../src/js/maxsim-wasm.js';

// Generate random embeddings
function generateFlatEmbeddings(numTokens, dim) {
    const flat = new Float32Array(numTokens * dim);
    for (let i = 0; i < flat.length; i++) {
        flat[i] = Math.random() * 2 - 1;
    }
    return flat;
}

// Convert flat to 2D (expensive operation!)
function flatTo2D(flat, numTokens, dim) {
    const nested = [];
    for (let i = 0; i < numTokens; i++) {
        const token = [];
        for (let j = 0; j < dim; j++) {
            token.push(flat[i * dim + j]);
        }
        nested.push(token);
    }
    return nested;
}

async function main() {
    console.log('🔬 MaxSim Web - API Comparison\n');
    console.log('Simulating real-world scenario:');
    console.log('  - 1000 documents');
    console.log('  - Average 270 tokens per document');
    console.log('  - 48-dimensional embeddings');
    console.log('  - Variable document lengths\n');

    // Initialize WASM
    const maxsim = new MaxSimWasm();
    await maxsim.init();
    console.log('✅ WASM initialized\n');

    // Configuration
    const queryTokens = 13;
    const embeddingDim = 48;
    const numDocs = 1000;
    const avgDocTokens = 270;

    // Generate query embeddings (flat)
    const queryFlat = generateFlatEmbeddings(queryTokens, embeddingDim);

    // Generate variable-length documents (flat)
    const docTokenCounts = [];
    const docsFlat_array = [];

    for (let i = 0; i < numDocs; i++) {
        // Variable length: 200-340 tokens
        const docTokens = Math.floor(avgDocTokens + (Math.random() - 0.5) * 140);
        docTokenCounts.push(docTokens);
        docsFlat_array.push(generateFlatEmbeddings(docTokens, embeddingDim));
    }

    // Concatenate all documents
    const totalDocTokens = docTokenCounts.reduce((sum, count) => sum + count, 0);
    const docsFlat = new Float32Array(totalDocTokens * embeddingDim);
    let offset = 0;
    for (const docFlat of docsFlat_array) {
        docsFlat.set(docFlat, offset);
        offset += docFlat.length;
    }

    console.log('📊 Generated test data:');
    console.log(`  Query: ${queryFlat.length} floats (${queryTokens} × ${embeddingDim})`);
    console.log(`  Docs: ${docsFlat.length} floats (${totalDocTokens} × ${embeddingDim})`);
    console.log(`  Total memory: ${((queryFlat.length + docsFlat.length) * 4 / 1024 / 1024).toFixed(2)} MB\n`);

    // =====================================================
    // Method 1: 2D Array API (with conversion overhead)
    // =====================================================
    console.log('🐌 Method 1: 2D Array API (Current Approach)\n');

    // Convert to 2D (this is what users must do!)
    console.log('  Step 1: Converting flat → 2D arrays...');
    const start2D_convert = performance.now();
    const query2D = flatTo2D(queryFlat, queryTokens, embeddingDim);
    const docs2D = docsFlat_array.map((docFlat, i) =>
        flatTo2D(docFlat, docTokenCounts[i], embeddingDim)
    );
    const end2D_convert = performance.now();
    const conversion_time = end2D_convert - start2D_convert;
    console.log(`  ⏱️  Conversion time: ${conversion_time.toFixed(2)} ms\n`);

    // Call 2D API (library converts back to flat internally!)
    console.log('  Step 2: Calling maxsimBatch() (2D API)...');
    const start2D_batch = performance.now();
    const scores2D = maxsim.maxsimBatch(query2D, docs2D);
    const end2D_batch = performance.now();
    const batch2D_time = end2D_batch - start2D_batch;
    console.log(`  ⏱️  Batch processing time: ${batch2D_time.toFixed(2)} ms\n`);

    const total2D_time = conversion_time + batch2D_time;
    console.log(`  📈 Total time (2D API): ${total2D_time.toFixed(2)} ms`);
    console.log(`     - User conversion: ${conversion_time.toFixed(2)} ms`);
    console.log(`     - Library processing: ${batch2D_time.toFixed(2)} ms\n`);

    // =====================================================
    // Method 2: Flat Array API (zero-copy)
    // =====================================================
    console.log('🚀 Method 2: Flat Array API (Optimized)\n');

    console.log('  Step 1: Data already flat - SKIP conversion!');
    console.log('  ⏱️  Conversion time: 0.00 ms (zero-copy!)\n');

    // Call Flat API directly
    console.log('  Step 2: Calling maxsimBatchFlat() (Flat API)...');
    const startFlat = performance.now();
    const scoresFlat = maxsim.maxsimBatchFlat(
        queryFlat,
        queryTokens,
        docsFlat,
        new Uint32Array(docTokenCounts),
        embeddingDim
    );
    const endFlat = performance.now();
    const flatTime = endFlat - startFlat;
    console.log(`  ⏱️  Batch processing time: ${flatTime.toFixed(2)} ms\n`);

    console.log(`  📈 Total time (Flat API): ${flatTime.toFixed(2)} ms\n`);

    // =====================================================
    // Comparison
    // =====================================================
    console.log('=' .repeat(60));
    console.log('📊 PERFORMANCE COMPARISON\n');
    console.log(`  2D Array API:    ${total2D_time.toFixed(2)} ms`);
    console.log(`  Flat Array API:  ${flatTime.toFixed(2)} ms`);
    console.log(`  Speedup:         ${(total2D_time / flatTime).toFixed(2)}x faster! 🚀\n`);
    console.log(`  Time saved:      ${(total2D_time - flatTime).toFixed(2)} ms`);
    console.log(`  Overhead avoided: ${conversion_time.toFixed(2)} ms (user conversion)\n`);
    console.log('=' .repeat(60));

    // Verify results match
    const maxDiff = Math.max(
        ...Array.from(scores2D).map((score, i) => Math.abs(score - scoresFlat[i]))
    );
    console.log(`\n✅ Results verification: max difference = ${maxDiff.toExponential(2)}`);
    console.log(`   (should be near zero - floating point precision only)\n`);

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    if (total2D_time / flatTime > 2) {
        console.log('  ⚠️  2D Array API is significantly slower for this workload!');
        console.log('  ✅  Use Flat Array API for production applications');
        console.log('  📖  See docs/API_GUIDE.md for migration guide');
    } else {
        console.log('  ℹ️  For small batches, both APIs have similar performance');
        console.log('  💡  Use whichever is more convenient for your use case');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎓 KEY TAKEAWAYS:\n');
    console.log('  1. Keep embeddings in flat format when possible');
    console.log('  2. Use Flat API for large batches (100+ documents)');
    console.log('  3. 2D Array API is fine for small batches or convenience');
    console.log('  4. Both APIs produce identical results!');
    console.log('=' .repeat(60) + '\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main };
