import fs from 'node:fs';
import path from 'node:path';

// Parse .env.testnet secara manual tanpa perlu install library tambahan
function loadApiKey() {
    const envPath = path.resolve(process.cwd(), '.env.testnet');
    if (!fs.existsSync(envPath)) return process.env.ALCHEMY_API_KEY;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('ALCHEMY_API_KEY=')) {
            return trimmed.replace('ALCHEMY_API_KEY=', '').trim().replace(/^["']|["']$/g, '');
        }
    }
    return process.env.ALCHEMY_API_KEY;
}

const apiKey = loadApiKey();

if (!apiKey) {
    console.error('❌ Error: ALCHEMY_API_KEY tidak ditemukan di .env.testnet');
    process.exit(1);
}

const url = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
// Contoh address Vitalik Buterin untuk tes ambil data transaksi
const targetAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function runTest() {
    console.log(' Mengirim request ke Alchemy Mainnet...');

    const body = {
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
            {
                fromBlock: '0x0',
                toBlock: 'latest',
                fromAddress: targetAddress,
                category: ['external', 'erc20'],
                maxCount: '0x3', // Ambil 3 transaksi saja untuk test
                order: 'desc',
                withMetadata: true,
                excludeZeroValue: true
            }
        ]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.error) {
            console.error('❌ Error dari Alchemy:', data.error);
            return;
        }

        console.log('✅ Berhasil terkoneksi & dapat data!\n');
        console.log(JSON.stringify(data.result, null, 2));
    } catch (err) {
        console.error('❌ Request error:', err);
    }
}

runTest();
