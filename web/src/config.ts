import type { Address, Hex } from 'viem';
// Authoritative mainnet assignment. Legacy Sepolia metadata is intentionally not used.
export const addresses = {
 token:'0x0eB84279EFF71548Ac5212Ce17760B1E54692825', oracle:'0x15D85339aaC34C44d12a7df5Bbeb43BAdA1ddf6b',
 staking:'0x2DE7e18F40fbf46aF66c8Bc34aF14faD5f77180A', claim:'0xB8A3376F2b6A95418074Ac5669A2A5a6f028BD4C',
 treasury:'0x322706a008Dd02cb17BB28604e7fC6B14d5a501F', hook:'0x8E406c6C6cf6cfb859Ca7de009C66b18560A20cc',
 imd:'0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7', pnkstr:'0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf', imdstr:'0x80271ce20184e38f4afe90d4ca134304d197aca2',
 imdNft:'0x0000ec93127baa929e58e97dd0095a2bfb38ec1d', pepeNft:'0x999ce0ce8c5f7661e0c74a568ffe27ceb9177bdb',
 relayer:'0x087Bada60BB18d1667F03a8BA6b2aE5394E0E2C5', dead:'0x000000000000000000000000000000000000dEaD',
 zero:'0x0000000000000000000000000000000000000000', multicall:'0xcA11bde05977b3631167028862bE2a173976CA11',
 position:'0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e', stateView:'0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
 poolManager:'0x000000000004444c5dc75cB358380D2e3dE08A90',
} as const satisfies Record<string,Address>;
export const POOL_ID: Hex = '0x3bae96a49d241bb4035056e713afdaba06294b72e8124ad7bdc693b16f7d35dc';
export const POOL_KEY = {currency0:addresses.zero,currency1:addresses.token,fee:0,tickSpacing:60,hooks:addresses.hook};
export const HOOK_DEPLOY_BLOCK = 26128644n; // Sourcify deployment metadata
export const LP_ID = 436936n;
export const RPC_URLS = ['https://ethereum-rpc.publicnode.com','https://eth.drpc.org','https://ethereum.publicnode.com'];
export const explorer = (address:string) => `https://etherscan.io/address/${address}`;
export const links = {x:'https://x.com/IaMaDamIMD',dex:`https://dexscreener.com/ethereum/${POOL_ID}`,buy:`https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${addresses.token}`,lp:`https://etherscan.io/nft/${addresses.position}/${LP_ID}`,api:'https://api.imd.fun/oracle/requests',market:`https://api.dexscreener.com/latest/dex/pairs/ethereum/${POOL_ID}`};
export const rewards = [{key:'imd',symbol:'IMD',address:addresses.imd},{key:'pnkstr',symbol:'PNKSTR',address:addresses.pnkstr},{key:'imdstr',symbol:'IMDSTR',address:addresses.imdstr}] as const;
export const collections = [{id:0,name:'IMD NFT',key:'imdNft',address:addresses.imdNft,first:0,count:2000},{id:1,name:'Swarm Pepe',key:'pepeNft',address:addresses.pepeNft,first:1,count:1178}] as const;
export const QUESTION = `Using public market data for Ethereum mainnet tokens IMD (${addresses.imd}), PNKSTR (${addresses.pnkstr}) and IMDSTR (${addresses.imdstr}), compare each token's price change in ETH over the 24 hours ending at the end of the window. Rank them by that change from lowest (rank 1) to highest (rank 3), breaking ties in the order IMD, PNKSTR, IMDSTR. Answer with one three-digit integer made of IMD's rank, then PNKSTR's rank, then IMDSTR's rank; for example 213 means PNKSTR fell the most, IMD was in the middle and IMDSTR did best.`;
