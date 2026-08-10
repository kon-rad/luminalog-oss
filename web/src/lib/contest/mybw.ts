// Malaysia Blockchain Week 2026 (#MYBW2026) — research corpus.
//
// Compiled from the official site and agenda, the organiser's press material, and
// Malaysian trade press (see MYBW_SOURCES). Rendered by the "Malaysia Blockchain Week
// 2026" tab on /mybw2026-contest and served to agents via /api/contest/data and
// /mybw2026-contest/skill.md.
//
// The point of this file is the essay contest: it exists so an entrant answering
// "How can blockchain technology be used to benefit Malaysia?" can cite what the
// Malaysian industry actually said about itself, on the record, in July 2026.

export interface MybwSource {
  label: string
  url: string
}

export const MYBW = {
  name: 'Malaysia Blockchain Week 2026',
  hashtag: '#MYBW2026',
  theme: 'Bridging Realities: Where Everyone Meets Web3',
  dates: '29–30 July 2026',
  venue: 'World Trade Centre Kuala Lumpur (WTCKL)',
  hours: '10:00–18:00 both days',
  organiser: 'ACTIV8, the creative marketing lab under Singapore-based BlockOffice',
  organiserQuote: {
    text:
      'MYBW 2026 is where those voices are heard to build a conversation about what Web3 adoption means in Malaysia',
    by: 'Noelle Lee, Managing Partner and organising host, ACTIV8',
  },
  /** Phrases as "backed by <backing>". */
  backing: "Malaysia's Ministry of Digital",
  ticketsFrom: 'RM119',
  website: 'https://myblockchainweek.com/',
  sideEvents: 'https://luma.com/mybw2026',
  x: 'https://x.com/MalaysiaBCW',
} as const

/** Headline numbers, each traceable to a source in MYBW_SOURCES. */
export const MYBW_SCALE: { value: string; label: string }[] = [
  { value: '2 days', label: '29–30 July 2026, 10:00–18:00' },
  { value: '2 stages', label: 'ACTIV8 Retail Stage and DFNS Institutional Stage' },
  { value: '150+', label: 'confirmed speakers' },
  { value: '200+', label: 'international blockchain leaders on the programme' },
  { value: '60+', label: 'sponsors and ecosystem partners' },
]

export type MybwStage = 'retail' | 'institutional'
export type MybwKind = 'keynote' | 'panel' | 'fireside'

export interface MybwSession {
  day: 1 | 2
  stage: MybwStage
  time: string
  kind: MybwKind
  title: string
  speakers: string[]
  moderator?: string
  /** Set when the session bears directly on the essay prompt. */
  whyItMatters?: string
}

export const MYBW_STAGES: { id: MybwStage; label: string }[] = [
  { id: 'retail', label: 'ACTIV8 Retail Stage' },
  { id: 'institutional', label: 'DFNS Institutional Stage' },
]

export const MYBW_SESSIONS: MybwSession[] = [
  // ─────────────────────────── Day 1 · Retail Stage ───────────────────────────
  { day: 1, stage: 'retail', time: '10:00', kind: 'keynote', title: 'Building Infrastructure for the Agentic Economy on Cloud', speakers: ['Andrew Liu (Alibaba Cloud)'] },
  { day: 1, stage: 'retail', time: '10:00', kind: 'fireside', title: 'Fireside Chat with CoinGecko', speakers: ['Bobby Ong (CoinGecko)'], moderator: 'Noelle Lee (ACTIV8)' },
  { day: 1, stage: 'retail', time: '10:15', kind: 'panel', title: 'Stablecoins & Agentic Payments: Building the Next Generation of Global Commerce', speakers: ['Moses Lee (Anchorage Digital)', 'Nischint Sanghavi (Visa)', 'Eddy Christian Ng (Tether)'], moderator: 'Christian Corrigan (BlockOffice)' },
  {
    day: 1, stage: 'retail', time: '10:30', kind: 'keynote',
    title: "From Skepticism to Adoption: Malaysia's Crypto Journey and the Next Five Years",
    speakers: ['David Low (Hata)'],
    whyItMatters:
      'A licensed Malaysian exchange operator framing the last decade of domestic adoption and the next five years, the clearest statement of the local arc the essay prompt is asking about.',
  },
  { day: 1, stage: 'retail', time: '10:45', kind: 'fireside', title: 'Fireside Chat with Etherscan', speakers: ['Matthew Tan (Etherscan)'], moderator: 'Noelle Lee (ACTIV8)' },
  { day: 1, stage: 'retail', time: '11:15', kind: 'panel', title: 'The Consumer Use Cases That Finally Make Web3 Feel Useful', speakers: ['Cris D. Tran (Open Campus)', 'YC (Universe Pro)', 'Josh Dominic (MoonExe)'], moderator: 'Han (Superteam Malaysia)' },
  { day: 1, stage: 'retail', time: '11:45', kind: 'panel', title: 'Tokenised Stocks: Real Retail Opportunity or Just a Better Story?', speakers: ['Johannes Tiong (Treasures Finance)', 'Rania Rahardja (Ondo Finance)', 'Walter Lee (BNB Chain)'], moderator: 'Kevin Ang (Enhanced)' },
  {
    day: 1, stage: 'retail', time: '12:15', kind: 'keynote',
    title: 'The Landlord and a Twin: A tale of AI and Blockchain in Malaysia',
    speakers: ['Nicholas Chong (pitchIN)'],
    whyItMatters:
      'pitchIN runs a Securities Commission–registered equity crowdfunding and token platform, so this is a domestic-market view of where AI and blockchain actually touch Malaysian businesses.',
  },
  { day: 1, stage: 'retail', time: '12:30', kind: 'panel', title: 'Perp DEXs: Better Trading Experience or Just Faster Risk?', speakers: ['Benjamin Chuang (Luno)', 'Alan Hung (KalqiX)', 'Ram Tan (Global Trade Finance Inc)'], moderator: 'Leo Siow (Avantis)' },
  { day: 1, stage: 'retail', time: '14:00', kind: 'keynote', title: 'Unlocking the Next Wave of Stablecoin Growth', speakers: ['Nischint Sanghavi (Visa)'] },
  { day: 1, stage: 'retail', time: '14:15', kind: 'panel', title: 'From Chatbots to AI Agents: What Changes for Everyday Users?', speakers: ['Su Fen Goh (Chad)', 'Jake Ong (PennyWhale)', 'Shawn Tan (Call Me Sensei)'], moderator: 'Hoa Ha Phuong (Spores Network)' },
  { day: 1, stage: 'retail', time: '14:45', kind: 'fireside', title: 'Fireside Chat with Binance', speakers: ['Steven McWhirter (Binance)'], moderator: 'Noelle Lee (ACTIV8)' },
  { day: 1, stage: 'retail', time: '15:00', kind: 'panel', title: 'Will Wallets Replace Banking Apps?', speakers: ['Felix Fan (Trust Wallet)', 'Wesley (NOXCAT)', 'Aki (Tangem)'], moderator: 'Arravind Prabu (AgroBilis Sdn Bhd)' },
  {
    day: 1, stage: 'retail', time: '15:30', kind: 'panel',
    title: 'The Future Starts on Campus: Youth Leadership in Blockchain, AI, and Entrepreneurship',
    speakers: ["Abby Tan (Taylor's Blockchain Club)", 'Teh Jun Heng (APU Blockchain Club)', 'Jarvis Lim (Monash Blockchain Club)'],
    moderator: 'Joshua Ahimaz (Sunway Blockchain Club)',
    whyItMatters:
      'Four Malaysian university blockchain clubs on one panel. Human-capital and education arguments in an essay can point at a named, existing pipeline rather than a hypothetical one.',
  },
  { day: 1, stage: 'retail', time: '16:00', kind: 'keynote', title: "One Wallet, Every Chain: Fixing Web3's Fragmentation Problem", speakers: ['Teddy Tan (CoinEx Wallet)'] },
  { day: 1, stage: 'retail', time: '16:15', kind: 'keynote', title: 'When Wallets Outlive Their Owners: Custody, Trusts and the Keys Nobody Inherits', speakers: ['Tan Ji Sheng (Gambit Custody Sdn Bhd)'] },
  {
    day: 1, stage: 'retail', time: '16:30', kind: 'panel',
    title: 'Can Regulation Accelerate Innovation Instead of Slowing It Down?',
    speakers: ['David Low (Hata)', 'Adriel Wong (TRM Labs)', 'Chan Wei Chi (Kinetic DAX Sdn Bhd)'],
    moderator: 'Richard Wee (Richard Wee Chambers)',
    whyItMatters:
      'Two SC-regulated Malaysian digital asset exchanges plus a Malaysian law firm arguing the regulation question directly. This is the counterweight to any essay that treats regulation purely as friction.',
  },
  { day: 1, stage: 'retail', time: '17:00', kind: 'panel', title: 'From TradFi to Tokenized Finance: The Next Evolution of Capital Markets', speakers: ['Kenneth Bok (SC Ventures)', 'Jitendra Singh Jaitawat (Helix)', 'Ranjit Singh Gill (Kenanga Investors Berhad)'], moderator: 'Dave Chew (HomeCrowd)' },
  { day: 1, stage: 'retail', time: '17:30', kind: 'panel', title: 'Do RWA Tokenisation Actually Solve a Liquidity Problem, or Just Move It On-Chain?', speakers: ['Felix Eigelshoven (DFNS)', 'Aldwin Andikko (BitGo)', 'Yanshan Tan (Utila)'], moderator: 'Kevin Ang (Enhanced)' },

  // ──────────────────────── Day 1 · Institutional Stage ───────────────────────
  { day: 1, stage: 'institutional', time: '10:45', kind: 'keynote', title: 'Agentic AI and Blockchain Convergence', speakers: ['Minh Do (Animoca Brands)'] },
  { day: 1, stage: 'institutional', time: '11:00', kind: 'keynote', title: 'Navigating Crypto Narratives In a Regular Era', speakers: ['Jeroni Khoo (Luno)'] },
  { day: 1, stage: 'institutional', time: '11:15', kind: 'panel', title: 'How can we mobilise financial institutions to bring regulated assets on-chain', speakers: ['Thomas Chou (Canton Foundation)', 'Mark Tang (Hydra X)', 'Adriel Wong (TRM Labs)'], moderator: 'Nicholas Chong (pitchIN)' },
  { day: 1, stage: 'institutional', time: '11:45', kind: 'panel', title: 'Banks vs. Fintechs vs. Native Crypto Firms: Who Wins Institutional Distribution?', speakers: ['Teong Hng (Satori Research)', 'Kenneth Lim (Figment)', 'Taka Miura (Sony Ventures Corporation)'], moderator: 'Gabriel Gareth Foo (Securitize)' },
  { day: 1, stage: 'institutional', time: '12:15', kind: 'keynote', title: 'Dash: 12 Years of True Decentralization and What Comes Next?', speakers: ['Daria Chernozub (Dash Blockchain)'] },
  {
    day: 1, stage: 'institutional', time: '12:30', kind: 'panel',
    title: 'Stablecoins, Tokenized Deposits and the Future of Settlement',
    speakers: ['Jonathan Low (Elephants Inc.)', 'Sahib Anandsongvit (Pandora / Superteam Thailand)', 'John Kiew (CertiK)'],
    moderator: 'Harpreet Singh Maan (TEIZA Sdn Bhd)',
    whyItMatters:
      'Tokenised deposits are one of the three things Bank Negara is actually piloting in 2026. This panel is the industry-side companion to the regulator’s Digital Asset Innovation Hub.',
  },
  { day: 1, stage: 'institutional', time: '14:00', kind: 'keynote', title: 'TRON and the Convergence of DeFi, TradFi and AI (virtual)', speakers: ['Justin Sun (TRON)'] },
  { day: 1, stage: 'institutional', time: '14:15', kind: 'panel', title: 'Tokenized Real-World Assets: Hype Cycle or Genuine Portfolio Diversifier?', speakers: ['Katherine Ng (Katashe Solutions)', 'Nellie Tan (Monad Foundation)', 'Stephanie Chew (OpenEden)'], moderator: 'Jevon Cheng (Kinetic DAX Sdn Bhd)' },
  { day: 1, stage: 'institutional', time: '14:45', kind: 'fireside', title: 'Is Developer Still Important In the Vibe Coding Era?', speakers: ['Max Lee (GIL System Technology)'], moderator: 'Joan Ng (ARC)' },
  { day: 1, stage: 'institutional', time: '15:15', kind: 'panel', title: 'Can Prediction Markets Become Institutional-Grade Products?', speakers: ['Kamron (Hashlock)', 'Ee Wui Yang (e23)', 'Yassine El Kourt (MoonUp)'], moderator: 'Eason Chai (ELVTD.io)' },
  { day: 1, stage: 'institutional', time: '15:45', kind: 'panel', title: 'How Data Becomes a Strategic Asset in the AI Era', speakers: ['Jin Choo (Atlas Oracle)', 'Aileen (SuperNet)', 'Roy Kek (EMERGE Group)'], moderator: 'Henry Lee (KiteAI)' },
  { day: 1, stage: 'institutional', time: '16:15', kind: 'panel', title: 'When Bitcoin Slows, Where Does Attention Go?', speakers: ['Lucas Lee (ARC)', 'Arravind Prabu (AgroBilis Sdn Bhd)', 'Kelvyn Chuah (SINEGY DAX)'], moderator: 'Colbert Low (IMBA Finance)' },
  { day: 1, stage: 'institutional', time: '16:45', kind: 'panel', title: 'Can AI Improve Trust Online, or Destroy It Faster?', speakers: ['Summer Kho (Syuenart)', 'Pipat Wattanamongkolsiri (AiROVA / 9 CAT GROUP)', 'Prince Gupta (CoinFerenceX)'], moderator: 'Goldchau (DI)' },
  { day: 1, stage: 'institutional', time: '17:15', kind: 'keynote', title: "Who's CryptoBilis", speakers: ['Nicholas Chang (CryptoBilis)'] },
  { day: 1, stage: 'institutional', time: '17:30', kind: 'panel', title: 'Fake AI vs. Real Crypto: How to Know if That Project is Actually Running on Blockchain', speakers: ['Walter Lee (BNB Chain)', 'Zoe Chen (Unibase)', 'Terrence (PingCAP)'], moderator: 'Harith Kamarul (Etherscan)' },

  // ─────────────────────────── Day 2 · Retail Stage ───────────────────────────
  { day: 2, stage: 'retail', time: '10:00', kind: 'keynote', title: 'How to Read Web3 Security Audit Reports', speakers: ['Kamron (Hashlock)'] },
  { day: 2, stage: 'retail', time: '10:15', kind: 'keynote', title: "Ideas & Market Timing: Perps, Prediction Markets, Tokenized Stocks. What's next?", speakers: ['Kevin Ang (Enhanced)'] },
  {
    day: 2, stage: 'retail', time: '10:30', kind: 'keynote',
    title: "Malaysia's Digital Asset Regulatory Landscape: Code is Law… But So Is the Law",
    speakers: ['Derrick Leong (GRVT)'],
    whyItMatters:
      'A direct treatment of the Malaysian regulatory perimeter (the SC on the securities side, Bank Negara on the money side) and of the limits of "code is law" inside a real jurisdiction.',
  },
  { day: 2, stage: 'retail', time: '10:45', kind: 'keynote', title: 'Internet Money: How Stablecoins Are Rebuilding Finance From the Payment Layer Up', speakers: ['Kenneth Bok (SC Ventures)'] },
  {
    day: 2, stage: 'retail', time: '11:00', kind: 'panel',
    title: "Ringgit on the Blockchain: Navigating Malaysia's 2026 Stablecoin Rules & Tokenization",
    speakers: ['Max Lee (GIL System Technology)', 'Ashwin Chockalingam (BLOX)', 'Douglas Gan (Sera.cx)'],
    moderator: 'Zhao Farn Chung (Masverse)',
    whyItMatters:
      'The single most on-topic session of the whole conference: a ringgit stablecoin panel held in the same year Bank Negara began piloting exactly that. If an essay cites one session, cite this one.',
  },
  { day: 2, stage: 'retail', time: '11:30', kind: 'panel', title: "Navigating Malaysia's Startup Ecosystem: What Investors and Founders Need to Know", speakers: ['Jacob Ko (Superscrypt)', 'Emerson (LongHash Ventures)', 'Taraec Hussein (Jelawang Capital)'], moderator: 'Chris Ling (No Limit Holdings)' },
  { day: 2, stage: 'retail', time: '12:00', kind: 'keynote', title: 'The Blockchain for Global Finance', speakers: ['Nick See Tong (Base)'] },
  { day: 2, stage: 'retail', time: '12:15', kind: 'fireside', title: 'Fireside Chat with Wintermute', speakers: ['Yoann (Wintermute)'], moderator: 'Noelle Lee (ACTIV8)' },
  { day: 2, stage: 'retail', time: '12:45', kind: 'keynote', title: 'From Wallet to Consumer App: How NOXCAT Is Making Web3 Your Daily Routine', speakers: ['Wesley (NOXCAT)'] },
  { day: 2, stage: 'retail', time: '14:00', kind: 'keynote', title: 'A Solid Foundation For Your Business on Chain', speakers: ['Janice Tang (Cregis)'] },
  {
    day: 2, stage: 'retail', time: '14:15', kind: 'panel',
    title: 'What Institutions Need from Policymakers Now?',
    speakers: ['Fuad Alhabshi (Halogen Capital Sdn Bhd)', 'Daniel Lee (Cactus Custody)', 'Harry Hwang (FLOWRA)'],
    moderator: 'Jonathan Chee (CCACC Sdn Bhd)',
    whyItMatters:
      'Halogen Capital runs Malaysia’s Shariah-compliant digital asset funds, so this is where Islamic finance and institutional crypto policy meet on one stage.',
  },
  { day: 2, stage: 'retail', time: '14:45', kind: 'panel', title: 'The Maturing Bitcoin Ecosystem: Infrastructure, Access and Institutional Demand', speakers: ['Tan Ji Sheng (Gambit Custody Sdn Bhd)', 'Zach Khoo (ViaBTC Group)', 'Charlene Wong (Aquanow)'], moderator: 'Jason Chew (BTC Education Hub)' },
  { day: 2, stage: 'retail', time: '15:15', kind: 'fireside', title: 'Fireside Chat with Luno', speakers: ['Aaron Tang (Luno)'], moderator: 'Noelle Lee (ACTIV8)' },
  { day: 2, stage: 'retail', time: '15:30', kind: 'panel', title: 'Agentic AI in Financial Services: Promise vs Control', speakers: ['Douglas Hsu (CMT Digital)', 'David Cai (Proxima Investments)', 'Josh Lee (ShardLab)'], moderator: 'Frederick Tan (The Block)' },
  { day: 2, stage: 'retail', time: '16:00', kind: 'keynote', title: 'Building Trust for the Next Digital Economy', speakers: ['Ee Wui Yang (e23)'] },
  { day: 2, stage: 'retail', time: '16:15', kind: 'panel', title: 'Collecting, Flipping or Investing? The Many Faces of TCG Culture', speakers: ['Shimal2i (9 CAT GROUP)', 'YS (Rarible)', 'Ryan Li (Renaiss)'], moderator: 'KC Thee (NextRare, Inc.)' },
  { day: 2, stage: 'retail', time: '16:45', kind: 'panel', title: 'Building Without Big Tech: How Local Devs Can Run Massive Models on a Budget', speakers: ['Nicky Li (CoreAccess)', 'Stanley Nguyen (Pixel8Labs)', 'Shuenrui Lee (Qwen)'], moderator: 'Alvin Yap (Happening Labs)' },
  { day: 2, stage: 'retail', time: '17:15', kind: 'panel', title: 'PayFi and the Next Generation of Global Payment Infrastructure', speakers: ['Nathanael Christian (IDRX)', 'Yuen Khai Goh (V Systems)', 'Yasser Khan (Teel)'], moderator: 'Ross Stephenson' },

  // ──────────────────────── Day 2 · Institutional Stage ───────────────────────
  { day: 2, stage: 'institutional', time: '10:00', kind: 'keynote', title: 'AI Agent Security', speakers: ['Kang Li (CertiK)'] },
  { day: 2, stage: 'institutional', time: '10:15', kind: 'panel', title: 'Interoperability, Liquidity and the Infrastructure Bottlenecks Ahead', speakers: ['Quincy Dagelet (Rhei)', 'William Au (Solstice Finance)', 'Randy Tan (EUGE)'], moderator: 'Yudhishthra (Aqua0)' },
  { day: 2, stage: 'institutional', time: '10:45', kind: 'keynote', title: 'Agentic Trading: A New Way to Trade', speakers: ['Alex Svanevik (Nansen)'] },
  { day: 2, stage: 'institutional', time: '11:00', kind: 'panel', title: 'From Signup to First Use: Why Most People Still Drop Off', speakers: ['Joe Chen (Movement)', 'Ryan De Souza (Offchain)', 'Nick See Tong (Base)'], moderator: 'Marianne C (Superteam Malaysia)' },
  { day: 2, stage: 'institutional', time: '11:30', kind: 'panel', title: 'What Jobs Will AI and Web3 Actually Create?', speakers: ['Richard Armstrong (TA Ventures)', 'Jerome Ong (Maximum Frequency Ventures)', 'Hisham Ibrahim (Gobi Partners)'], moderator: 'Jun Ahn (Hashtrip)' },
  { day: 2, stage: 'institutional', time: '12:00', kind: 'keynote', title: 'Nextflow AI OS: First AI-Native Agent OS', speakers: ['Sam Zhao (Nextflow AI OS)'] },
  { day: 2, stage: 'institutional', time: '12:15', kind: 'panel', title: 'Prediction Markets: Smarter Internet Signal or Just Better Gambling?', speakers: ['YellowPanther (CRISP / GamingGrid)', 'Jarod Cheah (Swipe 1)'], moderator: 'Pukerainbow (Pukecast)' },
  {
    day: 2, stage: 'institutional', time: '14:00', kind: 'keynote',
    title: 'Three Years Later, What We Learned Running a Ringgit Stablecoin',
    speakers: ['Ethan Chung (BLOX)'],
    whyItMatters:
      'Three years of operating experience, not a proposal. The most concrete evidence at the conference that a ringgit-denominated stablecoin is a real product with real lessons rather than a thought experiment.',
  },
  { day: 2, stage: 'institutional', time: '14:15', kind: 'panel', title: 'Attention Is the New Distribution: Who Wins It and Why', speakers: ['Cheelip Ong (Katashe Solutions)', 'Kenneth Shek (Moca Network)', 'Jesse Heo (BlockOffice)'], moderator: 'Maeve (Pukecast)' },
  { day: 2, stage: 'institutional', time: '14:45', kind: 'panel', title: 'The Autonomous Investor: How AI Agents Are Reshaping Trading and Investing', speakers: ['Ben Yorke (Starchild)', 'Zamri (Nuwanta Academy)', 'Soh Wei Sheng (Traderpreneur Xcellence Sdn Bhd)'], moderator: 'Kai (TankDAO)' },
  { day: 2, stage: 'institutional', time: '15:15', kind: 'keynote', title: 'How to Build Crypto WEALTH, And Avoid Crypto REGRET', speakers: ['Cristian Ulloa (Liquid Loans)'] },
  { day: 2, stage: 'institutional', time: '15:45', kind: 'keynote', title: 'Why Options + AI?', speakers: ['Eesheng Goh (Thetanuts Finance)'] },
  { day: 2, stage: 'institutional', time: '16:00', kind: 'panel', title: 'How Institutions Are Rethinking Borrowing, Yield and Liquidity in On-Chain Finance', speakers: ['Cristian Ulloa (Liquid Loans)', 'Benjamin Hor (Thetanuts Finance)', 'Agost Makszin (Lendary)'], moderator: 'Juga (Sats Terminal)' },
  { day: 2, stage: 'institutional', time: '16:30', kind: 'keynote', title: 'Why So Much Bitcoin Still Sits Idle', speakers: ['Quincy Dagelet (Rhei)'] },
  { day: 2, stage: 'institutional', time: '16:45', kind: 'panel', title: 'Investing in Inclusion: Unlocking Opportunities for Women in Web3', speakers: ['Paula Vulic (Underground Agency)', 'YY Wong (MYRT)', 'Suhanna Husein (CoKeeps)'], moderator: 'Chezka Gonzales (Philippine Blockchain Week)' },
  {
    day: 2, stage: 'institutional', time: '17:15', kind: 'panel',
    title: 'Can Anyone Own Everything? Exploring Fractional Ownership Through RWA',
    speakers: ['Triston Khoo (Ecosync FZ LLC)', 'Ines Yong (Ark Labs)', 'Bobby Sim Si Han (DatoDurian)'],
    moderator: 'Alvin Ng (Mooniverse X Ventures)',
    whyItMatters:
      'DatoDurian tokenises Malaysian durian orchards, a rare, concrete, unmistakably Malaysian real-world-asset case an essay can name.',
  },
]

/** Facts about the Malaysian market that were the backdrop to the conference. */
export const MYBW_MARKET_FACTS: { fact: string; note: string }[] = [
  {
    fact: 'MYRC, a proposed ringgit-backed stablecoin ecosystem',
    note:
      'Discussed throughout the week alongside tokenised deposits, and echoed on stage by BLOX, which reported three years of operating experience running a ringgit stablecoin.',
  },
  {
    fact: 'Khazanah Nasional is exploring tokenised sukuk and tokenised money-market funds',
    note:
      "Malaysia's sovereign wealth fund looking at the instrument Malaysia already leads the world in, tokenised.",
  },
  {
    fact: 'Both conventional and Islamic tokenised money-market funds are in development',
    note: 'The dual financial system, extended on-chain.',
  },
  {
    fact: "~RM2.7 trillion Islamic capital market; 64% of Malaysia's capital market is Islamic finance",
    note: 'Any argument about tokenisation in Malaysia is mostly an argument about Islamic instruments.',
  },
  {
    fact: 'Malaysia accounts for roughly one third of global sukuk outstanding',
    note: 'The deepest existing market in the exact asset class RWA tokenisation is trying to reach.',
  },
  {
    fact: "Bank Negara Malaysia's Fintech Regulatory Sandbox supervises blockchain pilots",
    note: 'Alongside the Digital Asset Innovation Hub running the 2026 stablecoin and tokenised-deposit pilots.',
  },
  {
    fact: 'Malaysia Digital, led by MDEC, drives talent development and investment attraction',
    note: 'The human-capital and inbound-investment arm of the same policy push.',
  },
]

/** Malaysian companies and institutions visible on the programme. */
export const MYBW_LOCAL_ECOSYSTEM: { name: string; what: string }[] = [
  { name: 'Luno', what: 'SC-regulated digital asset exchange, one of the longest-running in Malaysia' },
  { name: 'Hata', what: 'Malaysian licensed digital asset exchange' },
  { name: 'Kinetic DAX', what: 'SC-registered digital asset exchange operator' },
  { name: 'SINEGY DAX', what: 'Malaysian digital asset exchange' },
  { name: 'CoinGecko', what: 'Malaysian-founded, globally used crypto data aggregator' },
  { name: 'Etherscan', what: 'Malaysian-founded Ethereum block explorer' },
  { name: 'BLOX', what: 'Ringgit stablecoin operator, three years live' },
  { name: 'pitchIN', what: 'SC-registered equity crowdfunding and token offering platform' },
  { name: 'Gambit Custody', what: 'Malaysian digital asset custody, including inheritance and trusts' },
  { name: 'Halogen Capital', what: "Malaysia's Shariah-compliant digital asset fund manager" },
  { name: 'Kenanga Investors', what: 'Established Malaysian asset manager engaging with tokenised capital markets' },
  { name: 'CryptoBilis', what: 'Malaysian crypto community and media' },
  { name: 'Superteam Malaysia', what: 'Local builder and developer community' },
  { name: 'Masverse', what: 'Malaysian metaverse and Web3 studio' },
  { name: 'DatoDurian', what: 'Tokenised Malaysian durian orchards, real-world assets, literally' },
  { name: 'MYRT', what: 'Malaysian Women in Web3 community' },
  {
    name: "Taylor's, APU, Monash and Sunway blockchain clubs",
    what: 'Four university student societies, on stage together',
  },
]

export const MYBW_SOURCES: MybwSource[] = [
  { label: 'Malaysia Blockchain Week 2026, official site and agenda', url: 'https://myblockchainweek.com/' },
  { label: '#MYBW2026 side-event calendar (Luma)', url: 'https://luma.com/mybw2026' },
  { label: 'The Edge Malaysia, Malaysia blockchain scene in spotlight as MYBW returns to KL', url: 'https://theedgemalaysia.com/node/811492' },
  { label: 'crypto.news, MYBW 2026 positions Kuala Lumpur as APAC’s emerging Web3 and AI hub', url: 'https://crypto.news/malaysia-blockchain-week-2026-positions-kuala-lumpur-as-apacs-emerging-web3-and-ai-hub-for-global-builders-capital-and-innovation/' },
  { label: 'BitPinas, Malaysia Blockchain Week 2026 spotlights Web3’s financial future', url: 'https://bitpinas.com/pr/malaysia-blockchain-week-2026-spotlights' },
  { label: 'PR Newswire, MYBW 2026 media launch', url: 'https://www.prnewswire.com/apac/news-releases/mybw-2026-media-launch-sets-the-stage-for-blockchains-next-chapter-302682258.html' },
  { label: 'Malaysia Blockchain Association, MYBW 2026 preview', url: 'https://malaysiablockchain.org/blog/malaysia-blockchain-week-2026-preview/' },
  { label: 'MY Blockchain Week on X (@MalaysiaBCW)', url: 'https://x.com/MalaysiaBCW' },
]

/** Sessions flagged as directly useful for the essay prompt. */
export const MYBW_ESSAY_PICKS = MYBW_SESSIONS.filter((s) => s.whyItMatters)

export function sessionsFor(day: 1 | 2, stage: MybwStage): MybwSession[] {
  return MYBW_SESSIONS.filter((s) => s.day === day && s.stage === stage)
}
