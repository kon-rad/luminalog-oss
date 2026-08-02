// Knowledge Base for the Bank Negara Malaysia Museum & Art Gallery.
//
// Every entry is anchored to something we photographed on 30 July 2026 (see
// ./gallery.ts — each image carries `topics: string[]` of slugs from this file),
// then enriched with public sources and general background so an essayist or an
// agent can go deeper than the wall text alone.
//
// Body paragraphs may contain wiki links in the form [[slug]] or [[slug|label]].
// `renderKnowledgeText` in the KnowledgeBase component resolves them.

export type KnowledgeCategory =
  | 'visit'
  | 'money'
  | 'islamic-finance'
  | 'institution'
  | 'economy'

export interface KnowledgeSource {
  label: string
  url: string
}

export interface KnowledgeEntry {
  slug: string
  title: string
  category: KnowledgeCategory
  /** One-line definition, used in the index and in link previews. */
  summary: string
  /** Paragraphs. May contain [[slug]] / [[slug|label]] wiki links. */
  body: string[]
  /** Why this matters to someone writing about blockchain and Malaysia. */
  angle?: string
  seeAlso: string[]
  sources?: KnowledgeSource[]
}

export const KNOWLEDGE_CATEGORIES: { id: KnowledgeCategory; label: string }[] = [
  { id: 'visit', label: 'The visit' },
  { id: 'money', label: 'Money & payments' },
  { id: 'islamic-finance', label: 'Islamic finance' },
  { id: 'institution', label: 'The central bank' },
  { id: 'economy', label: 'The Malaysian economy' },
]

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ──────────────────────────────── THE VISIT ────────────────────────────────
  {
    slug: 'sasana-kijang',
    title: 'Sasana Kijang',
    category: 'visit',
    summary:
      "Bank Negara Malaysia's centre of learning on Jalan Dato Onn, Kuala Lumpur, and home of the Museum & Art Gallery.",
    body: [
      'Sasana Kijang was opened by Bank Negara Malaysia in 2011 as a centre of excellence for learning and knowledge — a conference and research campus rather than a banking hall. The building takes its name from the *kijang*, the barking deer on the Bank\'s crest (see [[kijang-coin]]).',
      'The Museum & Art Gallery occupies part of the complex, and its architectural centrepiece is a spiral staircase modelled on a nautilus shell, coiling up through the atrium. The address is Sasana Kijang, 2 Jalan Dato Onn, 50480 Kuala Lumpur.',
      'Bank Negara Malaysia itself has been on Jalan Dato Onn since 1970, when it moved into a purpose-built headquarters costing 9.6 million Malayan dollars, designed by Public Works Department architect Nik Mohamed Nik Mahmood. Before that the Bank operated out of part of the PWD Selangor building near Dataran Merdeka (see [[bnm-history]]).',
    ],
    seeAlso: ['museum-galleries', 'visiting', 'bnm-history', 'kijang-coin'],
    sources: [
      { label: 'Museum & Art Gallery BNM — About Us', url: 'https://museum.bnm.gov.my/v2/aboutus.html' },
    ],
  },
  {
    slug: 'museum-galleries',
    title: 'The six permanent galleries',
    category: 'visit',
    summary:
      'Children’s, Bank Negara Malaysia, Economics, Islamic Finance, Numismatics and Art — plus a rotating Temporary Gallery.',
    body: [
      'The museum runs six permanent galleries across four levels, plus a Temporary Gallery for rotating exhibitions. The fold-out gallery guide sets them out clearly:',
      '**Level 3 — Art Gallery.** A 10,000 sq ft space showing a rotating selection of the Central Bank\'s collection of Malaysian and Southeast Asian art, acquired since 1962. **Numismatics Gallery** — the history of money, from objects used as currency through to modern banknotes (see [[trade-dollars]], [[ringgit]]). **Temporary Gallery** — the venue for temporary exhibitions.',
      '**Bank Negara Malaysia Gallery** — the roles and responsibilities of the central bank (see [[bnm-mandate]]). **Economics Gallery** — how economic policy shapes a nation, and Malaysia\'s progress from independence to today (see [[malaysia-economy]]). **Islamic Finance Gallery** — early Islamic concepts of commerce and finance and their reach into the modern world (see [[islamic-finance]]).',
      '**Ground floor — Children\'s Gallery.** Hands-on games built around "Save, Spend and Share", including the RM1 Million Tunnel lined with Malaysian banknote denominations and series.',
      'We visited on the morning of 30 July 2026 and covered the Economics, Numismatics, Islamic Finance and Bank Negara Malaysia galleries in roughly ninety minutes. The Art Gallery and Children\'s Gallery are still on the list.',
    ],
    seeAlso: ['sasana-kijang', 'visiting', 'malaysia-economy', 'islamic-finance'],
    sources: [
      { label: 'Museum & Art Gallery BNM', url: 'https://museum.bnm.gov.my/v2/index.html' },
    ],
  },
  {
    slug: 'visiting',
    title: 'Visiting, practically',
    category: 'visit',
    summary: 'Free entry, no booking, and absolutely no bags inside the galleries.',
    body: [
      'Admission is free and no advance booking is required.',
      'Bags are not allowed inside the galleries. There are combination lockers by the entrance, but the storage area is not individually secured end-to-end — leave anything genuinely valuable at your hotel. Photography of the exhibits is permitted, which is why this gallery exists at all.',
      'The museum is inside [[sasana-kijang]], on Jalan Dato Onn. Getting there from the Kuala Lumpur city centre is a ten-to-twenty minute drive depending on traffic.',
    ],
    seeAlso: ['sasana-kijang', 'museum-galleries'],
  },
  {
    slug: 'mybw2026',
    title: 'Malaysia Blockchain Week 2026',
    category: 'visit',
    summary:
      'The 29–30 July 2026 Web3 conference at the World Trade Centre Kuala Lumpur that this museum trip spun out of.',
    body: [
      'Malaysia Blockchain Week 2026 (#MYBW2026) ran on 29–30 July 2026 at the World Trade Centre Kuala Lumpur, 10:00–18:00 both days, under the theme **"Bridging Realities: Where Everyone Meets Web3"**. It is organised by ACTIV8, the creative marketing lab under Singapore-based BlockOffice, and is backed by Malaysia\'s Ministry of Digital. General admission started from RM119.',
      'The programme ran two stages — the ACTIV8 Retail Stage and the DFNS Institutional Stage — with 150+ confirmed speakers, 200+ international blockchain leaders and 60+ sponsors and ecosystem partners. Names included Justin Sun (TRON), Steven McWhirter (Binance), Alex Svanevik (Nansen), Nischint Sanghavi (Visa), Moses Lee (Anchorage Digital), and the Malaysian-founded pair Bobby Ong (CoinGecko) and Matthew Tan (Etherscan).',
      'Organiser Noelle Lee framed it as: *"MYBW 2026 is where those voices are heard to build a conversation about what Web3 adoption means in Malaysia."*',
      'For the essay contest the useful part is not the headline speakers but the Malaysia-specific sessions: a ringgit stablecoin panel ("Ringgit on the Blockchain: Navigating Malaysia\'s 2026 Stablecoin Rules & Tokenization"), an operator keynote from BLOX titled "Three Years Later — What We Learned Running a Ringgit Stablecoin", a Malaysian regulatory-landscape keynote from GRVT, a panel asking whether regulation can accelerate innovation, and a panel of four Malaysian university blockchain clubs. See [[myrc-stablecoin]] and [[malaysia-web3-ecosystem]].',
      'On the morning of day two, a group of attendees peeled off from the conference floor and went to a central bank museum instead. That trip produced the photographs in this gallery, the [[essay-contest]], and this knowledge base.',
      'The full agenda, the market backdrop, the domestic ecosystem and the sources are on the **Malaysia Blockchain Week 2026** tab of this page.',
    ],
    angle:
      'The conference is evidence that the Malaysian conversation has already moved past "should we". Sessions were about operating a ringgit stablecoin, what institutions need from policymakers, and where the regulatory perimeter sits. An essay pitched at "Malaysia should explore blockchain" is arguing with nobody.',
    seeAlso: ['essay-contest', 'museum-galleries', 'myrc-stablecoin', 'malaysia-web3-ecosystem', 'regulation'],
    sources: [
      { label: 'Malaysia Blockchain Week 2026', url: 'https://myblockchainweek.com/' },
      { label: '#MYBW2026 events calendar', url: 'https://luma.com/mybw2026' },
    ],
  },
  {
    slug: 'essay-contest',
    title: 'The Argo Essay Contest',
    category: 'visit',
    summary:
      'Write 750–800 words on how blockchain technology can benefit Malaysia, publish it, and win $100 USDC.',
    body: [
      'The contest asks one question: *How can blockchain technology be used to benefit Malaysia?* Entries must be 750–800 words, published on a public web page under your real name, carry the subtitle "Malaysia Blockchain Week 2026 Argo Essay Contest", and include an Ethereum mainnet address for the prize.',
      'It began as a companion to the museum trip during [[mybw2026]] and was originally open only to people who came along on the day. It is now open to anyone, anywhere — attendance is no longer a requirement.',
      'Everything in this knowledge base exists to make the essay easier to write well. The wall text in the [[islamic-finance|Islamic Finance Gallery]] on [[riba]], [[hawala-suftaja|suftaja]] and [[sukuk]], and the Numismatics Gallery material on [[trade-dollars]] and [[ledgers|written records]], all bear directly on the question.',
    ],
    seeAlso: ['mybw2026', 'islamic-finance', 'ledgers'],
  },

  {
    slug: 'myrc-stablecoin',
    title: 'MYRC and the ringgit on-chain',
    category: 'visit',
    summary:
      'A proposed ringgit-backed stablecoin ecosystem — and an operator who has already run one for three years.',
    body: [
      'The recurring subject at [[mybw2026|Malaysia Blockchain Week 2026]] was putting the ringgit on a blockchain, discussed under the name **MYRC** — a proposed ringgit-backed stablecoin ecosystem — alongside tokenised deposits and both conventional and Islamic tokenised money-market funds.',
      'This is not speculative framing. Bank Negara Malaysia onboarded three initiatives to its **Digital Asset Innovation Hub** in 2026 to test ringgit stablecoins and tokenised deposits in real wholesale payment use cases, domestic and cross-border, including settlement of tokenised assets (see [[regulation]]). And on the conference\'s institutional stage, **Ethan Chung of BLOX** gave a keynote titled *"Three Years Later — What We Learned Running a Ringgit Stablecoin"* — three years of operating experience, not a proposal.',
      'The Islamic dimension is explicit rather than incidental. **Khazanah Nasional**, Malaysia\'s sovereign wealth fund, is exploring tokenised [[sukuk]] and tokenised money-market funds, and Bank Negara has said some pilot use cases will examine Shariah considerations. That is the [[dual-system|statutory dual financial system]] extending on-chain rather than being bypassed.',
      'Scale of the market this would touch: Malaysia\'s Islamic capital market is around **RM2.7 trillion**, roughly **64%** of the country\'s capital market is Islamic finance, and Malaysia accounts for roughly **one third of global sukuk outstanding**.',
    ],
    angle:
      'This is the strongest available answer to the essay prompt, because the counterfactual is already running. The interesting question is not whether a ringgit stablecoin is possible but which of the three settlement assets — a stablecoin, a tokenised deposit, or central bank money — suits which use case, and what Shariah compliance does to the design.',
    seeAlso: ['mybw2026', 'regulation', 'sukuk', 'dual-system', 'epayments', 'islamic-finance'],
    sources: [
      {
        label: 'BitPinas — MYBW 2026 spotlights Web3’s financial future',
        url: 'https://bitpinas.com/pr/malaysia-blockchain-week-2026-spotlights',
      },
      {
        label: 'BNM onboards ringgit stablecoin and tokenised deposit pilots',
        url: 'https://www.theasianbanker.com/press-releases/bank-negara-malaysia-onboards-ringgit-stablecoin-and-tokenised-deposit-pilots-under-digital-asset-innovation-hub',
      },
    ],
  },
  {
    slug: 'malaysia-web3-ecosystem',
    title: 'The Malaysian Web3 ecosystem',
    category: 'visit',
    summary:
      'Who is actually building here — exchanges, custodians, a Shariah-compliant fund manager, and four university clubs.',
    body: [
      'Two of the most-used pieces of infrastructure in global crypto were founded by Malaysians: **CoinGecko** (Bobby Ong) and **Etherscan** (Matthew Tan). Both were on stage at [[mybw2026]].',
      'The regulated domestic layer: **Luno**, **Hata**, **Kinetic DAX** and **SINEGY DAX** operate as Securities Commission–registered digital asset exchanges; **pitchIN** runs SC-registered equity crowdfunding and token offerings; **Gambit Custody** does digital asset custody including inheritance and trusts; **Halogen Capital** runs Malaysia\'s Shariah-compliant digital asset funds; **Kenanga Investors**, an established asset manager, is engaging with tokenised capital markets.',
      'The builder layer: **BLOX** (a ringgit stablecoin, three years live — see [[myrc-stablecoin]]), **Masverse**, **CryptoBilis**, **Superteam Malaysia**, and **MYRT**, a Malaysian women-in-Web3 community. **DatoDurian** tokenises Malaysian durian orchards, which is about as literal a real-world asset as the category gets.',
      'The pipeline layer, and the one most often missed: the blockchain clubs of **Taylor\'s University, Asia Pacific University, Monash Malaysia and Sunway University** shared a panel called "The Future Starts on Campus". Human-capital arguments in an essay can point at a named, existing pipeline rather than a hypothetical one.',
      'Around it: **Malaysia Digital**, led by MDEC, handles talent development and investment attraction, and Bank Negara\'s **Fintech Regulatory Sandbox** provides a supervised environment for blockchain pilots.',
    ],
    angle:
      'An essay that proposes something Malaysia should build is stronger if it names who would build it. Every layer already exists — the gap is usually distribution or regulatory clarity, not capability.',
    seeAlso: ['mybw2026', 'myrc-stablecoin', 'regulation', 'fintech', 'malaysia-economy'],
    sources: [
      { label: 'Malaysia Blockchain Week 2026 — agenda', url: 'https://myblockchainweek.com/' },
      {
        label: 'The Edge Malaysia — Malaysia blockchain scene in spotlight',
        url: 'https://theedgemalaysia.com/node/811492',
      },
    ],
  },

  // ──────────────────────────── MONEY & PAYMENTS ─────────────────────────────
  {
    slug: 'kijang-coin',
    title: 'The kijang coin and the Bank’s logo',
    category: 'money',
    summary:
      'A gold Kelantan coin stamped with a barking deer, chosen in 1964 as the basis for the Bank Negara Malaysia crest.',
    body: [
      'The gold kijang coins of Kelantan and Patani circulated between roughly the 13th and 16th centuries and are among the earliest coins of the Malay sultanates. They take their name from the *kijang* — the Malayan barking deer — embossed on the obverse. The design is thought to have originated in India, and the figure is believed to have begun as a humped bull before evolving into a deer.',
      'In 1964, the first Malaysian Governor of Bank Negara Malaysia, Tun Ismail Mohamed Ali, selected the gold kijang coin as the inspiration for the Bank\'s logo — partly for its value and prestige, and partly for a specific reason the museum makes a point of: unlike most early coins from the Malay Peninsula, which bore only Jawi script, the kijang coin carried an image. He commissioned the sculptor Abdul Wahab Haji Tahir to stylise it.',
      'The finished crest combines the kijang with a sun and a crescent moon — power, and Islam as the official religion of the federation. It is etched on the glass doors at [[sasana-kijang]] and gives the building its name.',
      'The kijang lives on in another form: the Kijang Emas, Malaysia\'s official gold bullion coin, first issued in 1996.',
    ],
    angle:
      'A national institution chose a pre-colonial, pre-national coin as its identity mark. The point being made is continuity of monetary sovereignty — worth noting for anyone writing about what "digital sovereignty" would even mean here.',
    seeAlso: ['pitis-money-tree', 'bnm-history', 'ringgit', 'sasana-kijang'],
    sources: [
      { label: "Bank Negara Malaysia — The Bank's Logo", url: 'https://www.bnm.gov.my/the-bank-s-logo' },
    ],
  },
  {
    slug: 'pitis-money-tree',
    title: 'Pitis and the money tree mould',
    category: 'money',
    summary:
      'Kelantan’s tin pitis were cast in branching tree-shaped moulds — a technique that arrived from Tang-dynasty China.',
    body: [
      'The Numismatics Gallery displays a pair of iron moulds from Kelantan dated 1904, alongside a cast "money tree". Most Kelantanese tin *pitis* were produced this way: molten tin poured into a branching mould, cooled, and then the individual coins snapped off the stem.',
      'The museum notes the method was probably introduced from China during the Tang Dynasty (618–906) — a reminder that the Malay Peninsula was a node on trade routes long before European traders arrived with [[trade-dollars]].',
      'Tin is not incidental here. It is one of the two commodities that carried the colonial-era economy (see [[commodities]]) and the reason the first railway line in Malaya was built.',
    ],
    seeAlso: ['kijang-coin', 'trade-dollars', 'commodities', 'minting'],
  },
  {
    slug: 'trade-dollars',
    title: 'The trade dollars',
    category: 'money',
    summary:
      'Before the ringgit there was no single currency — just any silver crown of at least 415 grains at 90% fineness.',
    body: [
      'From the 16th century, European traders brought silver coinage into the Malay Archipelago, and for centuries the region ran on a remarkable arrangement: no issuer monopoly at all. The trading community accepted **any** silver crown weighing at least 415 grains (26.9 g) at a fineness of 900 (90% silver). Trust was in the metal, verified by weight and assay, not in the sovereign whose face was on it.',
      'The gallery walks through the coins that circulated, each with a local nickname:',
      '**Eight Reales, Spain, 1764** — the Pillar Dollar, inscribed "Pillar of Hercules", known locally as *Ringgit Tua*, the old ringgit. **Eight Reales / One Peso, Mexico, 1874** — an eagle on a cactus, called *Ringgit Garuda*, *Ringgit Gerdun* or *Ringgit Burung*; the sunburst variety became *Ringgit Matahari*. **One Crown, Britain, 1804** — circulated by the British East India Company in Penang, Malacca and Singapore and accepted by merchants, despite never being granted legal tender status in the Straits Settlements.',
      '**One Dollar, British Hong Kong, 1866** — Britain built a mint in Hong Kong specifically to strike trade dollars, and deliberately matched the Mexican dollar\'s size and weight so it would be accepted. **One Yen, Meiji Japan** — Japan bought the Hong Kong mint\'s machinery and began striking 416-grain silver yen in 1870; in Terengganu this was *Ringgit Muda*, the young ringgit. **One Piastre, French Indo-China, 1898** — which printed its weight and fineness directly on the coin face.',
      '**One Dollar, British Royal Mint, 1899** — the British Trade Dollar, valid in the colonies from 2 February 1895, called *Ringgit Tongkat* (staff ringgit) after the trident in Britannia\'s hand. Demonetised via the Straits Settlements (Coinage) Order 1903, effective 31 August 1904, though it stayed legal tender in Hong Kong until 1 August 1935.',
      'The word *ringgit* itself means "jagged" — after the milled edges of these Spanish silver dollars. Malaysia\'s currency is named after a foreign coin\'s serrations (see [[ringgit]]).',
    ],
    angle:
      'A multi-issuer, competing-currency regime where acceptance rested on verifiable physical properties rather than issuer identity is a very close historical analogue to a multi-stablecoin world. It worked, and it also produced constant assay overhead — which is exactly what [[verification|verification cost]] means.',
    seeAlso: ['ringgit', 'verification', 'malacca', 'islamic-currency', 'minting'],
  },
  {
    slug: 'ringgit',
    title: 'The ringgit',
    category: 'money',
    summary:
      'Named for the jagged edge of Spanish silver dollars; issued by Bank Negara Malaysia from 12 June 1967.',
    body: [
      'Authority to issue currency was vested in Bank Negara Malaysia by the Central Bank of Malaya Ordinance 1958, but for nearly a decade Malaysian money continued to be printed in Britain under the Board of Commissioners of Currency Malaya and British Borneo. The Bank only assumed responsibility for production and issuance on **12 June 1967**.',
      'The first series ran from 1967 to 1983 across four issuances, in denominations of $1, $5, $10, $50, $100 and $1,000. All carried a tiger\'s-head watermark as the security feature, and all bore the image of the first King of Malaysia, Tuanku Abdul Rahman ibni Al-marhum Tuanku Muhammad — as every note still does. The $1,000 reverse showed the Parliament building.',
      'The ringgit is made up of one hundred sen. Its value was originally fixed at 0.290299 grams of fine gold; the old Malayan dollar had traded at 2 shillings 4 pence. Old Malayan notes stayed in circulation alongside the new Malaysian ones until they were demonetised on 16 January 1969.',
      'The name comes from [[trade-dollars|the Spanish silver dollars]] that circulated here for centuries: *ringgit* means jagged, describing their milled edges.',
    ],
    seeAlso: ['trade-dollars', 'banknote-design', 'minting', 'bnm-history', 'epayments'],
  },
  {
    slug: 'minting',
    title: 'Minting',
    category: 'money',
    summary:
      'From a 19th-century saddlebag mint to a 100-ton hydraulic press at Batu Tiga, Shah Alam.',
    body: [
      'Two objects in the museum bracket the whole history of making money.',
      'The first is a 19th-century **minting kit**, probably from Central Asia, in the Islamic Finance Gallery: three bronze containers for transporting molten metal, bronze scissors for trimming coin edges, a steel minting mould, and two stone seals for making trading tablets. A complete mint, portable.',
      'The second is a **100-ton hydraulic coining press** in the Numismatics Gallery. Malaysian coins were first minted on 12 June 1967 in five denominations sharing a motif; the $1 coin for normal circulation followed on 1 May 1971. Coins dated 1967, 1968 and 1969 were struck at the Royal Mint in London, and the 1970 one-sen and twenty-sen pieces at the Hamburg Mint in Germany.',
      'Everything from 1 sen to 50 sen has been minted domestically since the Bank Negara Malaysia Mint opened at Batu Tiga, Shah Alam, Selangor in July 1971, launched by the then Minister of Finance, Tun Tan Siew Sin. The third series of coins arrived in 2012, marking 45 years of coin issuance.',
      'Compare with [[pitis-money-tree|Kelantan\'s tin money trees]], which achieved batch production of coinage with nothing but a mould and gravity.',
    ],
    seeAlso: ['pitis-money-tree', 'ringgit', 'islamic-currency', 'bnm-history'],
  },
  {
    slug: 'banknote-design',
    title: 'Banknote design and songket motifs',
    category: 'money',
    summary:
      'Six songket weaving patterns, one per denomination, arranged as concentric squares in the “Unity of Design” panel.',
    body: [
      'The museum displays a piece called **Unity of Design**: six distinct *songket* motifs taken from Malaysian banknotes and arranged as concentric squares, smallest denomination outermost.',
      'At the centre is *songket melur*, from the RM1,000 note. The next layer is *teluk berantai*, from the RM500 — both notes from the second currency series. The third layer is *pucuk rebung pedada* from the RM100, then the basic *pucuk rebung* from the RM50, then *pucuk rebung berjuang* from the RM10. The outer border is *pucuk rebung lawi ayam*, from the RM5.',
      'The RM100, RM50, RM10 and RM5 motifs are exclusive to the fourth currency series, themed "Distinctively Malaysia". *Pucuk rebung* means bamboo shoot — a triangular motif that runs through Malay textile tradition.',
      'Design carries policy. Every note since 1967 has borne the image of the first King of Malaysia; the security features have evolved from a tiger\'s-head watermark (see [[ringgit]]) to modern optical elements.',
    ],
    angle:
      'Physical currency does cultural work that a token contract address does not. If you argue for tokenised money in an essay, it is worth saying what replaces this.',
    seeAlso: ['ringgit', 'minting', 'epayments'],
  },
  {
    slug: 'cheques',
    title: 'The cheque, 1,000+ years old',
    category: 'money',
    summary:
      'Roman praescriptiones, the Mauryan adesha, the Persian chak — payment instructions long predate banks.',
    body: [
      'The museum\'s History of the Cheque panel is a quiet correction to anyone who thinks payment instruments are a modern invention. A cheque is simply a written instruction directing a bank to pay an agreed amount to a beneficiary — developed so people would not have to carry large amounts of money. Its origin is hard to pin down, but cheques have been in use for over a thousand years.',
      '**100–1 BCE** — the ancient Romans used *praescriptiones*, a type of promissory note written in Latin on wooden tablets. **321–185 BCE** — the Maurya Empire in India used the *adesha*, an order on a banker to pay an amount to a third party. **c. 300 CE** — banks in Persian territory began issuing letters of credit called *chak*, the word behind "cheque".',
      'The Elements of a Cheque display is effectively a protocol specification: drawer bank, payee, "Account Payee Only" crossing, date, bearer, amount in words and in figures, the drawer\'s signature and account number, and the MICR line encoding cheque number, bank and branch codes. Eleven numbered fields, each doing one job.',
      'Fraud resistance was engineered in physically. A cheque perforator — the museum has one from 1890s New York, made by the Wesley Manufacturing Company — punched permanently inked perforated numerals into the paper so the amount could not be altered.',
      'Many countries later enacted cheque truncation laws, converting the physical cheque into an electronic form for transmission to the paying bank or clearing house. That is the bridge to [[epayments]].',
    ],
    angle:
      'The cheque is a bearer-transferable payment instruction with a signature, an amount, a counterparty, and anti-tamper features. Every one of those maps onto a signed transaction. The interesting difference is not the fields — it is who clears it.',
    seeAlso: ['epayments', 'hawala-suftaja', 'ledgers', 'verification'],
  },
  {
    slug: 'epayments',
    title: 'The migration to ePayments',
    category: 'money',
    summary:
      'Bank Negara treats the 2010s as the decade it built e-payment infrastructure, regulation, and — hardest of all — public confidence.',
    body: [
      'The Numismatics Gallery ends where you would not expect a money museum to end: with a section on giving up physical money.',
      'The Bank\'s own framing of the 2010s is worth quoting: it was "an important decade for building the regulatory structure, e-payment infrastructure and public confidence for the transition towards e-payments." Initiatives pushed the switch from paper-based payments and widened coverage of POS terminals and mobile banking.',
      'The **Safe Transfer of Money — In All Forms** panel states the underlying doctrine plainly: safe, reliable and efficient payment systems let monetary transactions complete quickly and with minimum risk, which facilitates economic activity and contributes to higher growth. Given that, Bank Negara "has a strong interest in ensuring that the payment systems in the country not only operate smoothly but are also being improved and developed to suit an increasingly more digital world."',
      'The **Distribution Lifecycle of the Ringgit** exhibit tracks a single RM20 note from a distribution centre, through strangers\' hands, and back to be destroyed and replaced. It is a life-cycle diagram for a bearer instrument — issuance, circulation, wear, retirement.',
      'The modern continuation of this line runs through DuitNow, real-time retail payments, and now [[regulation|tokenised deposits and ringgit stablecoin pilots]].',
    ],
    angle:
      'This is the single most useful frame in the museum for the essay prompt. Bank Negara does not describe itself as anti-innovation in payments; it describes itself as the party responsible for the rails being safe. Any blockchain proposal aimed at Malaysia has to answer to that framing.',
    seeAlso: ['cheques', 'fintech', 'regulation', 'ringgit', 'ledgers'],
  },
  {
    slug: 'ledgers',
    title: 'Writing it down: Al-Baqarah 282',
    category: 'money',
    summary:
      'A 1354 handwritten Quran from Uzbekistan, open at the verse that makes recording a debt contract obligatory.',
    body: [
      'The most striking object in the Islamic Finance Gallery, for anyone who works on distributed ledgers, is a handwritten Quran from Uzbekistan dated **1354**, displayed open at verse 282 of Surah Al-Baqarah.',
      'It is the longest verse in the Quran, and it is about lending. The museum\'s translation: *"O believers! When you contract a debt from one another for a fixed period, put it (its amount and period of repayment) in writing. And let a scribe write it down between you justly (truthfully), and no scribe should refuse to write as Allah has taught him…"*',
      'The label spells out the requirements: writing the financing contract is obligatory; it must be witnessed by a trustworthy person; and it applies regardless of how small the amount, with the repayment date included.',
      'Four requirements — write it down, record the amount, record the maturity, have it witnessed by someone trusted — arrive as a religious obligation seven hundred years before the manuscript on display, and roughly thirteen hundred before anyone wrote a smart contract.',
      'The [[hukum-kanun-melaka|Hukum Kanun Melaka]] carries the same instinct into Malay statute law, and [[islamic-finance|Islamic finance]] generally treats the contract as the primary object of design.',
    ],
    angle:
      'The strongest version of the essay-contest argument is not "blockchain is new". It is that this region has an unusually deep, explicitly documented tradition of written, witnessed, dated financial agreements — and that a public ledger is a continuation of it rather than a rupture. Say that carefully and you have an essay nobody else wrote.',
    seeAlso: ['islamic-finance', 'riba', 'hukum-kanun-melaka', 'cheques', 'verification'],
  },
  {
    slug: 'verification',
    title: 'Verification without trust',
    category: 'money',
    summary:
      'Assay scales, coins that print their own fineness, tughra seals — the pre-modern toolkit for checking a claim.',
    body: [
      'A theme runs through the museum that nobody labelled as a theme: how do you check that something is what it claims to be, when you do not trust the person handing it to you?',
      '**Weigh it.** The Safavid-era **Weighing Scales and Box** from 16th-century Iran is a portable assay kit — two sets of scales and a set of weights in a carved wooden box, for valuing gold, silver, jewellery and precious stones on the spot.',
      '**Publish the spec on the artefact.** The [[trade-dollars|French Indo-China Piastre]] of 1898 carries its weight and silver fineness — "TITRE 0.900, POIDS 27 GR." — stamped on the coin face. Self-describing money.',
      '**Standardise the units.** Caliph Umar Al-Khattab fixed the dinar at 4.25 grams and the dirham at 3.0, with 7 dinars to 10 dirhams (see [[islamic-currency]]).',
      '**Make forgery expensive.** The Ottoman **tughra** — the Sultan\'s calligraphic monogram, carved here into agate — served as official signature and seal, used to legalise documents and appearing on coins, flags, stamps and buildings as a mark of sovereignty. Difficult to draw, easy to recognise: a pre-digital signature scheme.',
      '**Witness it.** [[ledgers|Al-Baqarah 282]] requires a trustworthy witness to a debt contract.',
      'Every one of these is a cost paid to avoid needing to trust a counterparty. That cost is the thing cryptographic verification actually reduces.',
    ],
    seeAlso: ['trade-dollars', 'islamic-currency', 'ledgers', 'hawala-suftaja', 'cheques'],
  },

  // ───────────────────────────── ISLAMIC FINANCE ─────────────────────────────
  {
    slug: 'islamic-finance',
    title: 'Islamic finance',
    category: 'islamic-finance',
    summary:
      'Finance governed by Shariah principles — now a trillion-dollar industry, and one Malaysia has led for over a decade.',
    body: [
      'The gallery\'s own definition: "The basis of Islamic Finance lies in the principles of the Shariah, or Islamic Law. Islamic finance has undergone rapid growth and transformation. From an industry initially intended to fulfil the religious obligations of the Muslim community, it is now a trillion-dollar industry driven by well-defined business considerations and profit optimisation, whilst upholding Islamic principles."',
      'The **Basic Concepts and Principles** panel lists six intrinsic values that a Shariah-compliant transaction is meant to embody: economic well-being for all; fairness and justice for all; fair distribution of wealth; honesty and transparency; mutual cooperation, solidarity and harmony; and freedom to enter into contracts.',
      'Three things are prohibited: **riba** (interest — see [[riba]]), **gharar** (excessive uncertainty arising from deception or ignorance), and **maysir** (gambling and games of chance). All dealings must rest on mutual consent and the pursuit of lawful objectives.',
      'The *Majallah Al-Ahkam Al-Adliyyah* (The Mejelle), a 19th-century Ottoman codification of Hanafi rulings, is cited as the first written codification of these rules, including obligations around financial transactions.',
      'Malaysia\'s position is not incidental. More than 40% of the country\'s banking assets are Shariah-compliant, its Islamic capital market reached roughly RM2.7 trillion by end-2025, and it has topped the Islamic Finance Development Indicator for over a decade. See [[dual-system]], [[sukuk]], [[takaful]], [[mifc]].',
    ],
    angle:
      'Gharar — prohibited uncertainty about what you are actually buying — is the sharpest lens in this whole museum for evaluating a crypto product. A great many tokens fail it.',
    seeAlso: ['riba', 'dual-system', 'sukuk', 'takaful', 'bank-islam', 'islamic-golden-age', 'ledgers'],
    sources: [
      {
        label: 'Malaysia Islamic banking market share tops 40%',
        url: 'https://www.asas.my/malaysia-islamic-banking-system-edges-towards-banking-system-parity-as-financing-and-deposits-market-share-reach-40-and-total-aum-tops-rm1-3-trillion-us298bn/',
      },
    ],
  },
  {
    slug: 'riba',
    title: 'Riba',
    category: 'islamic-finance',
    summary:
      'The prohibition on interest — a response to lenders who could unilaterally increase what a borrower owed.',
    body: [
      'The literal meaning of *riba* is "to increase". The museum is precise about why it is forbidden: "Riba is forbidden in order to safeguard people from injustice and exploitation. The restriction on making profit through riba was in response to oppressive pre-Islamic money-lending practices in Mecca, which allowed a lender to unilaterally increase the sum owed if the borrower failed to make repayment in time."',
      'That is a specific abuse being outlawed — unilateral, post-hoc alteration of an agreed obligation. The underlying principle the panel gives is that "a Muslim should only profit through his own efforts, instead of charging the premium on the loan."',
      'The constructive counterpart is risk-sharing: *mudarabah*, profit-sharing between a capital provider and an entrepreneur, which Arab traders practised before Islam and which the Prophet Muhammad endorsed as consistent with Islamic principles (see [[islamic-golden-age]]).',
      'In modern practice this shapes product design: [[bank-islam|Bank Islam\'s]] wadiah savings and its Shariah credit card, [[takaful]] instead of conventional insurance, and [[sukuk]] instead of interest-bearing bonds.',
    ],
    angle:
      'A prohibition on a lender unilaterally changing terms after the fact is, functionally, a demand for contract immutability. Note that it does not prohibit return — it prohibits return without shared risk. DeFi lending protocols that pay yield with no identifiable risk-bearing counterparty sit awkwardly here.',
    seeAlso: ['islamic-finance', 'sukuk', 'takaful', 'bank-islam', 'ledgers'],
  },
  {
    slug: 'hawala-suftaja',
    title: 'Suftaja, hawalah and sakk',
    category: 'islamic-finance',
    summary:
      'Ninth-century instruments for moving value without moving money — you could cash a cheque in China against funds in Baghdad.',
    body: [
      'The museum\'s **Early Practice in Islamic Finance** panel records an innovation in payment methods that is genuinely startling in its reach: "Instead of cash, *sakk* (cheque) and *hawalah* for assignment of debt (similar to modern bills of exchange) were used. From the 9th century, Arab traders were able to cash cheques in China to access their funds in Baghdad."',
      'The **suftaja** — displayed here as a Qajar-dynasty example from Iran, denominated 500 Toman — is described as "a bill of exchange or letter of credit, used to expedite long-distance payments or fund transfers. The suftaja would be issued by one party to be used by the bearer, to pay another party, with a monetary agreement beforehand. The suftaja helped to avoid the risk of transporting money."',
      'The problem being solved is exactly the problem a payment network solves: value has to move across a distance without the physical medium making the journey, because the journey is where the risk is. The solution was a network of correspondent relationships plus a transferable written claim.',
      'Note that *sakk* is the etymological root of "cheque" (see [[cheques]]), and *sukuk* is its plural — which is why [[sukuk|Islamic bonds]] carry that name.',
    ],
    angle:
      'Hawala networks still move enormous remittance volumes across Southeast Asia and the Gulf, largely outside the banking system, on the strength of reputation. Any serious essay on blockchain remittances into or out of Malaysia should engage with what hawala already does well and where it fails.',
    seeAlso: ['cheques', 'sukuk', 'islamic-golden-age', 'verification', 'islamic-finance'],
  },
  {
    slug: 'islamic-currency',
    title: 'Dinar and dirham',
    category: 'islamic-finance',
    summary:
      'Gold dinar, silver dirham, standardised at 7:10 in the early 7th century — an early written monetary standard.',
    body: [
      'Early Muslim rulers used gold (*dinar*) and silver (*dirham*) as their standard of value. The museum makes the economic point directly: standardised coinage across the Islamic trade routes "diminished the reliance on barter trade and provided merchants with a reliable system for pricing their goods."',
      'The names are borrowed. *Dinar* comes through the Syriac *dinara* from the Greek *denarion*; *dirham* from the Greek coin the *drachm*.',
      'Two standardisation moments are recorded. In the early 7th century **Caliph Umar Al-Khattab** fixed the exchange rate at 7 dinars to 10 dirhams, with the dinar at 4.25 grams and the dirham at 3.0 grams. The first dinar was minted in Damascus (694 AD), later in Basra and Al-Fustat. Under the Umayyad **Caliph Abd al-Malik ibn Marwan** (ruled 685–705), Islamic coins were inscribed with Arabic script specifically to differentiate them from the Greek and Persian coins in circulation — and these were the first gold coins to carry an Arabic inscription.',
      'The gallery also displays Islamic coins from four dynasties — Abbasid (198 AH / 814 AD), Buyid (399 AH / 1009 AD), Ayyubid (631 AH / 1234 AD) and Mughal (1146 AH / 1733 AD) — though on the day we visited they were out for conservation, with a printed placeholder in the case.',
    ],
    seeAlso: ['trade-dollars', 'minting', 'verification', 'islamic-golden-age'],
  },
  {
    slug: 'islamic-golden-age',
    title: 'The Islamic Golden Age and trade',
    category: 'islamic-finance',
    summary:
      'From the 7th to the 13th century, trade networks ran from the Atlantic to the China Sea — and contracts came with them.',
    body: [
      'The **Islamic Civilization: Trade and Finance** wall covers the period from the 7th century onwards, when, in the museum\'s words, the Golden Age "brought together men and women from different faiths and cultures to work together to create thousands of inventions and discoveries that changed the world."',
      'The Islamic Empire — Rashidun, Umayyad, Abbasid and Fatimid caliphates — was the world\'s leading economic power through the 7th to 13th centuries, with trade networks extending from the Atlantic Ocean and Mediterranean in the west to the Indian Ocean and China Sea in the east.',
      'The panel that matters most for this knowledge base: "Trade was so important that Muslim rulers created contracts, loans and more, which still influence trade today. As written in the Quran, *\'O Believers! Honor your contracts\'* (5:1) — which means honouring agreements is given as a commandment."',
      'Other threads: *waqf* endowments funded the Al-Qarawiyyin Mosque in Fez (859 AD) and Al-Azhar University in Cairo (971 AD); *Bayt al-Mal*, the public treasury, collected taxes for public works and charity; goods were traded at open-air *souks*; and Mocha in Yemen was the centre of the coffee trade from the 15th to 17th centuries. Al-Qarawiyyin is generally considered the oldest continuously operating degree-granting university in the world.',
      'The inventions credited on the wall include the camera obscura, surgical instruments, windmills, [[astrolabe|astrolabes]] and mechanical clocks — plus the transmission of [[arabic-numerals|Arabic numerals]] and the cartography of [[al-idrisi|Al-Idrisi]].',
    ],
    seeAlso: ['islamic-finance', 'hawala-suftaja', 'al-idrisi', 'astrolabe', 'arabic-numerals', 'islamic-currency'],
  },
  {
    slug: 'al-idrisi',
    title: 'Al-Idrisi and the Tabula Rogeriana',
    category: 'islamic-finance',
    summary:
      'A 1154 world atlas, presented on a two-metre silver disc, that remained the reference for three centuries.',
    body: [
      'Mohammed Al-Idrisi drew the **Tabula Rogeriana** for King Roger II of Sicily in 1154, spending fifteen years producing seventy maps for the atlas. He worked from his own travel, older maps — particularly Roman charts and Ptolemy — and, crucially, from reports collected from seafaring Muslim merchants, Norman voyagers and Christian scholars. The result was the most accurate map of its time.',
      'He is said to have presented it to King Roger II engraved on a disc of solid silver two metres in diameter. A manuscript version was also made, a few copies of which survive.',
      'For three centuries geographers used Al-Idrisi\'s maps unaltered. The museum lists who he influenced: Ibn Battuta, Ibn Khaldun, Piri Reis, and Christopher Columbus.',
      'The gallery also shows **Edrisi\'s Weltkarte** (German, 1789), a European edition of the 12th-century map. The original was drawn with south at the top; this version flips it to north-up for European readers. It carries good information on England, Russia and Finmark, extends the horn of Africa eastward until it nearly neighbours Southeast Asia, and reduces the Malay Peninsula, Java, Sumatra and Sri Lanka to a jumble of islands.',
    ],
    angle:
      'A crowdsourced dataset — merchant reports aggregated from people with no reason to agree — assembled into a shared reference that competitors then relied on for three hundred years. That is a public good produced by pooling information nobody individually owned.',
    seeAlso: ['islamic-golden-age', 'astrolabe', 'malacca'],
  },
  {
    slug: 'astrolabe',
    title: 'The astrolabe',
    category: 'islamic-finance',
    summary:
      'A handheld analogue computer for the sky, whose value to merchants was “beyond calculation.”',
    body: [
      'The museum displays a brass astrolabe alongside a 16th-century manuscript showing astronomers working with an armillary sphere to chart the stars, which were then turned into astrolabes.',
      'The label: "An astrolabe is an elaborate instrument, historically used by astronomers, navigators and astrologers. Its many uses include locating and predicting the positions of the sun, moon, planets and stars, determining local time given local latitude or vice-versa, as well as surveying and triangulation. **Its value for merchants and international trade was beyond calculation.**"',
      'The physical object is a pierced brass disc — a rotating *rete* projecting the star positions, an *alidade* for sighting, month names running around the limb. It computes by mechanical analogy: you set the sky to a moment, and read off the answer.',
      'The connection to finance is not decorative. Long-distance trade requires knowing where you are and when you are, and the [[al-idrisi|maps]] and the instruments were what made the [[islamic-golden-age|trade networks]] navigable.',
    ],
    seeAlso: ['islamic-golden-age', 'al-idrisi', 'arabic-numerals'],
  },
  {
    slug: 'arabic-numerals',
    title: 'Arabic numerals',
    category: 'islamic-finance',
    summary:
      'The ten digits reached Europe through trade, books and colonialism — and were once called ghubar, “dust”, numbers.',
    body: [
      'The gallery\'s **Evolution of Arabic numerals** wall traces the ten digits through their glowing mutations: from Indian Brahmi forms, through Persian and Arabic hands, to the shapes on a modern keyboard.',
      'The label: "These ten digits (1, 2, 3, 4, 5, 6, 7, 8, 9 and 0) are descended from the numeral system developed by Indian mathematicians, in which a sequence of digits such as \'975\' is read as a number. The Indian numerals were adopted by Persian and Arab mathematicians in India, and from there passed on to the Arabs further west. From there, they were transmitted to Europe in the Middle Ages when they were eventually welcomed as an easy alternative to the clumsy system of Roman numerals. The use of Arabic numerals spread around the world through trade, books and colonialism."',
      'They were also known as *ghubar* numbers, from the Arabic for dust — because Muslim calculators initially worked on dust boards.',
      'Positional notation with a zero is the precondition for practical bookkeeping, and therefore for [[ledgers|written financial records]] at any scale. It travelled the same routes as the money.',
    ],
    seeAlso: ['islamic-golden-age', 'ledgers', 'astrolabe'],
  },
  {
    slug: 'hukum-kanun-melaka',
    title: 'Hukum Kanun Melaka',
    category: 'islamic-finance',
    summary:
      'The 16th-century legal code of Malacca — 44 sections, of which sections 29 to 34 govern commerce.',
    body: [
      'The Hukum Kanun Melaka (also called the Undang-Undang Melaka, the Laws of Malacca, or Risalat Hukum Kanun) is the formal legal text of 16th-century Melaka society, covering social conduct and official rules alike. It sits alongside the Undang-Undang Laut Melaka, the Maritime Laws of Malacca.',
      'The museum is specific about its composition: the rules formed through the evolution of three influences — non-indigenous Hindu/Buddhist tradition, Islamic jurisdiction, and indigenous *adat* (custom). A hybrid legal system, written down.',
      'It contains 44 sections. **Sections 29 to 34** are the ones most related to business and financial practice: business ethics, the transaction of goods, the condition of goods on sale, and acceptable buyer and seller conduct — all based on Shariah.',
      'The manuscript on display is written in Jawi. It is a working commercial code from the port that made the Straits of Malacca the busiest waterway in the world (see [[malacca]]).',
    ],
    angle:
      'Malaysia has an indigenous, documented tradition of codifying commercial rules — including consumer-protection-shaped rules about the condition of goods sold. "On-chain governance" arguments land differently in a jurisdiction that has been writing down market rules since the 1500s.',
    seeAlso: ['malacca', 'islamic-finance', 'ledgers', 'trade-dollars'],
  },
  {
    slug: 'malacca',
    title: 'Malacca and the Straits',
    category: 'islamic-finance',
    summary:
      'The port that made this stretch of water the world’s busiest, and pulled Spanish, Mexican and Japanese silver into the archipelago.',
    body: [
      'The Malacca Sultanate, founded around 1400, turned the Straits into the hinge of Indian Ocean–South China Sea trade. The port drew merchants from Gujarat, China, Java, Arabia and later Europe — the Portuguese took it in 1511, the Dutch in 1641, the British in 1824.',
      'Two consequences show up throughout this museum. First, a written commercial legal code emerged: the [[hukum-kanun-melaka|Hukum Kanun Melaka]], with dedicated sections on trade. Second, an extraordinarily plural money supply developed: the [[trade-dollars]] of Spain, Mexico, Britain, Hong Kong, Japan and French Indo-China all circulated here, valued by silver content rather than issuer.',
      'The British occupied Penang (1786), Malacca (1795) and Singapore (1819) — the Straits Settlements — and the East India Company circulated British Crowns that merchants accepted without those coins ever being legal tender.',
      'Modern echo: the Straits still carry roughly a quarter of the world\'s traded goods. Malaysia\'s trade-to-GDP ratio remains above 100% (see [[international-trade]]).',
    ],
    seeAlso: ['hukum-kanun-melaka', 'trade-dollars', 'international-trade', 'commodities'],
  },
  {
    slug: 'tabung-haji',
    title: 'Tabung Haji and Ungku Aziz’s memorandum',
    category: 'islamic-finance',
    summary:
      'A 1959 memo about Malays selling land to fund the Hajj became the first Islamic financial institution in Malaysia.',
    body: [
      'In December 1959, Royal Professor Ungku Aziz submitted a memorandum to the Malaysian government titled *"Rancangan Membaiki Ekonomi Bakal-bakal Haji"* — a plan to improve the economy of prospective pilgrims. It opens with two Quranic verses: "perform the Haj and Umrah", and "cooperate in righteousness and piety".',
      'The research behind it, conducted in the early 1950s, found that the main purpose of domestic saving for the majority of Malays was to complete the Hajj — and that the *method* of saving was economically destructive. People sold land, jewellery or livestock to fund the pilgrimage and returned home financially worse off.',
      '**Lembaga Urusan Tabung Haji (LUTH)** was officially established in 1969 to fix this: a vehicle that let Muslims save gradually for the Hajj while investing those savings in economic and financial activity consistent with Islamic principles.',
      'The museum treats this as the origin point of the whole modern industry. As the [[bank-islam]] panel puts it, Tabung Haji "was the first institution to practise the concept of Islamic transaction" — and demand for more Shariah-based products is what prompted the government to move.',
    ],
    angle:
      'A financial institution designed backwards from an observed behaviour — people were already saving for a specific goal, badly — rather than forwards from a product. That is a better template for financial inclusion than most tokenised-savings pitches.',
    seeAlso: ['bank-islam', 'islamic-finance', 'dual-system'],
  },
  {
    slug: 'bank-islam',
    title: 'Bank Islam and the Islamic Banking Act 1983',
    category: 'islamic-finance',
    summary:
      'Tabung Haji proved the demand; a 1981 national steering committee wrote the rules; the Act took effect in April 1983.',
    body: [
      'The museum displays the classified green-bound report *Penubuhan Bank Islam* — the Report from the National Steering Committee on the Establishment of Bank Islam — with its covering letter.',
      'The sequence, as the label gives it: Islamic banking in Malaysia was established gradually, drawing on collective knowledge from earlier Islamic financial institutions worldwide. [[tabung-haji|Lembaga Tabung Haji]] (1969) was the first institution to practise Islamic transaction. Demand for more Islamic products was high, prompting the government to establish the **National Steering Committee in 1981** to provide an operating guideline for merchant banks founded on Shariah principles. Its feedback paved the way, and the government endorsed the **Islamic Banking Act 1983**, implemented in April 1983.',
      'Two objects show what the products actually looked like. A **Bank Islam savings account book** based on the *wadiah* contract — *wadiah* meaning custody or safekeeping, where you deposit cash or assets and the bank guarantees their safety while allowing withdrawal on demand. And the **Bank Islam Card**, the first purely Shariah-contract credit card offered in Malaysia to Muslims and non-Muslims alike, free of [[riba]] and *gharar*, and the first Malaysian credit card to use SMART chip technology.',
      'What follows from 1983 is the [[dual-system]]: conventional banks permitted to offer Islamic banking in parallel, creating two systems side by side.',
    ],
    seeAlso: ['tabung-haji', 'dual-system', 'riba', 'islamic-finance', 'takaful'],
  },
  {
    slug: 'takaful',
    title: 'Takaful',
    category: 'islamic-finance',
    summary:
      'Mutual insurance by donation into a common fund — first described by a merchant leasing a ship in the Ottoman Empire.',
    body: [
      'The concept of *takaful*, Islamic insurance, was first described by the 19th-century Muslim scholar **Ibn Abidin**, who wrote of a merchant leasing a ship for trade who also paid a sum known as *sukra* to a person who would, in return, compensate him if the cargo were damaged or destroyed during the voyage. This was practised in the Ottoman Empire.',
      'The mechanism the museum describes: "a group of participants agreeing to compensate each other against a defined loss or damage. Each participant contributes a *tabarru* or donation into a common fund which is managed by a third party, who is the takaful operator. Should there be a calamity befalling one of the participants, compensation will be paid from the common fund."',
      'The structural difference from conventional insurance is that the contribution is framed as a donation into a mutual pool rather than a premium paid to a risk-bearing counterparty — which sidesteps the *gharar* problem of selling an uncertain outcome.',
      'In Malaysia: a government task force studied the viability of an Islamic insurance company in 1982, the **Takaful Act** was enacted in 1984, and **Syarikat Takaful Malaysia Berhad**, the first takaful operator, commenced operations in 1985.',
    ],
    angle:
      'A mutual pool funded by donations, paying out on a defined event, administered by an operator rather than owned by one, is a very recognisable description of a parametric on-chain insurance pool. The Shariah reasoning for why it is structured that way is more rigorous than most protocol documentation.',
    seeAlso: ['islamic-finance', 'riba', 'bank-islam', 'dual-system'],
  },
  {
    slug: 'sukuk',
    title: 'Sukuk',
    category: 'islamic-finance',
    summary:
      'Asset-backed Islamic securities. Malaysia issued the first international sovereign sukuk in 2002 and still leads the market.',
    body: [
      '*Sukuk* is the plural of *sakk* — the same root as "cheque" (see [[hawala-suftaja]]). Rather than lending at interest, a sukuk gives the holder an undivided ownership interest in an underlying asset or venture, with returns derived from that asset. Structure is the whole point: the return has to trace to something real, which is how it avoids [[riba]].',
      'On **25 June 2002** the Malaysian Government issued an international five-year sovereign sukuk at **USD 600 million** — the first international Islamic sovereign securities offering. The museum displays the certificate in a gold-domed case. It set the pace for sovereign sukuk issuance by other countries.',
      'The Sukuk Timeline on the wall reads as a list of firsts: 1990, first ringgit sukuk by a foreign-owned non-Islamic company (Shell MDS, RM125m); 2001, first global corporate sukuk (Kumpulan Guthrie, USD150m); 2004, first ringgit sukuk by a supranational (IFC/World Bank, RM500m); 2007, first sukuk by a UK-owned multinational (Tesco Malaysia, RM3.5bn) and the world\'s first hybrid sukuk; 2009, first Emas sukuk (Petronas, USD1.5bn); 2011, first offshore RMB sukuk (Khazanah); 2012, single largest sukuk issuance (PLUS, RM30.6bn) and an innovative structure using airtime vouchers as the underlying asset (Axiata); 2014, first Japanese yen sukuk (Bank of Tokyo-Mitsubishi UFJ); 2015, longest USD-tenured sovereign sukuk at 30 years.',
      'Malaysia\'s **Islamic money market** is described as among the most advanced in the world, with average turnover of roughly RM1 billion a day, running instruments including Government Investment Issue (GII), Malaysian Islamic Treasury Bills (MITB), Bank Negara Monetary Notes-i (BNMN-i), Cagamas Mudharabah Bonds, Islamic Accepted Bills, Islamic Negotiable Instruments, Islamic Private Debt Securities, Ar Rahnu Agreement-i and Sukuk BNM Ijarah.',
      'Malaysia still accounts for roughly a third of global sukuk issuance and drove global issuance growth in the first half of 2026.',
    ],
    angle:
      'Sukuk are already asset-backed securities that require a documented link between a return and a real underlying asset — which is precisely the hard part of real-world-asset tokenisation. Malaysia has thirty years of practice structuring exactly this. It is arguably the strongest existing foundation in the country for on-chain RWA work.',
    seeAlso: ['islamic-finance', 'riba', 'mifc', 'hawala-suftaja', 'regulation'],
    sources: [
      {
        label: 'S&P: Malaysia drives global sukuk issuance growth, 1H 2026',
        url: 'https://theedgemalaysia.com/node/810735',
      },
    ],
  },
  {
    slug: 'mifc',
    title: 'MIFC — Malaysia International Islamic Financial Centre',
    category: 'islamic-finance',
    summary:
      'Launched 14 August 2006 to make Malaysia’s Islamic finance marketplace open to global participants.',
    body: [
      'The MIFC initiative was launched on **14 August 2006** to develop Malaysia\'s Islamic finance marketplace as a comprehensive ecosystem open to global industry players — the stated pitch being "Expertise, Innovation and Deal Flow."',
      'The **Malaysia: Our Marketplace** board maps the full stack: Islamic banking (domestic and international Islamic banks); [[takaful]] and re-takaful operators; the Islamic financial market (capital market, money market, foreign exchange, and the Bursa Suq Al-Sila commodity market); Islamic fund and wealth management; professional ancillary services (legal firms, rating agencies, trust companies, consultancies, research companies, Shariah advisories, accounting/tax/audit); and talent development.',
      'The governance layer is spelled out just as explicitly: the Islamic Financial Services Act, Government Funding Act and Capital Market Services Act; the Shariah Advisory Council of Bank Negara Malaysia and the Shariah Governance Framework; dispute resolution through a dedicated high court, the Asian International Arbitration Centre and the Financial Mediation Bureau; and infrastructure covering payment, clearing and settlement, custodians, principal dealers and listing on Bursa Malaysia.',
      'The trophy case records the recognition: "Islamic Financial Centre of the Year" at The Asset Triple A Asian Awards 2010, and Best International Islamic Finance Centre at the London Sukuk Summit in 2008, 2009 and 2010. See also the [[royal-award]].',
    ],
    angle:
      'Read that governance list again. Every element a tokenised financial market needs — custody, settlement, dispute resolution, listing, a standards body — Malaysia has already built once, for Islamic finance. The institutional template exists.',
    seeAlso: ['islamic-finance', 'sukuk', 'takaful', 'royal-award', 'dual-system'],
  },
  {
    slug: 'royal-award',
    title: 'The Royal Award for Islamic Finance',
    category: 'islamic-finance',
    summary:
      'A 916-gold medallion, awarded every two years since 2010, with the Sultan of Perak as Royal Patron.',
    body: [
      'Introduced in 2010 and held every two years under the [[mifc]] initiative, the Royal Award for Islamic Finance recognises Islamic finance visionaries who contribute to the growth of the global economy and the social progress of communities worldwide.',
      'The medallion on display is a replica made entirely of 916 gold, crafted by Royal Selangor. It measures 70mm in diameter and 2.5mm thick. The obverse bears the Royal Award logo; the reverse carries the MIFC initiative logo and the words "Shaping Islamic Finance Together".',
      'His Royal Highness Sultan Nazrin Muizzuddin Shah Ibni Almarhum Sultan Azlan Muhibbuddin Shah Al-Maghfur-lah, Sultan of Perak Darul Ridzuan, consented to serve as Royal Patron for Malaysia\'s Islamic Finance Initiative on **17 September 2014**.',
    ],
    seeAlso: ['mifc', 'islamic-finance', 'sukuk'],
  },
  {
    slug: 'dual-system',
    title: 'The dual financial system',
    category: 'islamic-finance',
    summary:
      'Malaysian law explicitly states the financial system consists of both a conventional and an Islamic system.',
    body: [
      'This is the sharpest legal fact in the museum. The **Central Bank of Malaysia Act 2009** explicitly codifies the duality of the Malaysian financial system: *"The financial system in Malaysia shall consist of the conventional financial system and the Islamic financial system."*',
      'Not a carve-out, not an exemption regime — a statutory declaration that two parallel systems both constitute the national financial system.',
      'How it came about: after the first Islamic bank was established in 1983 (see [[bank-islam]]), conventional banks in Malaysia were permitted to offer Islamic banking services in parallel with conventional products, creating a dual banking system in practice. The 2009 Act put it in statute.',
      'The **Malaysia: The Next Frontier** panel summarises the result: Islamic banking institutions, [[takaful]] and re-takaful operators, a vibrant Islamic money market and a dynamic Islamic capital market, all supported by a robust regulatory and supervisory framework.',
    ],
    angle:
      'Malaysia has already proven it can run two rule-sets over one financial system, with shared infrastructure, shared supervision and separate compliance logic. That is the single most transferable precedent in this building for how a regulated on-chain system could coexist with the existing one — and worth arguing explicitly rather than assuming a blockchain system must replace anything.',
    seeAlso: ['islamic-finance', 'bank-islam', 'takaful', 'bnm-mandate', 'regulation'],
  },

  // ───────────────────────────── THE CENTRAL BANK ────────────────────────────
  {
    slug: 'bnm-history',
    title: 'The birth of Bank Negara Malaysia',
    category: 'institution',
    summary:
      'Opened 26 January 1959 as Bank Negara Tanah Melayu, because a country that does not control its money does not control its future.',
    body: [
      'The Bank Negara Malaysia Gallery makes the argument for a central bank in economic terms, not patriotic ones.',
      'After the Second World War, Malaya looked strong — the world\'s largest producer of rubber and tin. But about **80% of export earnings came from just those two commodities**, so national fortunes rose and fell with global prices nobody in Malaya controlled. The population was growing and the country needed to diversify and industrialise, which required a financial system capable of supporting new industries. Malaya did not have one.',
      'The monetary system was still anchored to Britain: the Malayan dollar was tied to sterling, and local banking was dominated by British banks focused on financing trade rather than domestic development.',
      'In 1955 the International Bank for Reconstruction and Development was asked how a young country should manage monetary stability, regulate credit and support growth. Two experts, **G. M. Watson and Sir Sydney Caine**, produced what became known as the Watson-Caine Report, urging a centralised monetary authority.',
      'The **Central Bank of Malaya Ordinance 1958** was passed on 23 October 1958, creating a central bank with powers to issue currency, regulate banks and advise the government. **Bank Negara Tanah Melayu opened on 26 January 1959.** In 1963, with the formation of Malaysia, it became Bank Negara Malaysia. The Ordinance was later revised as the Central Bank of Malaysia Act 1958 (Act 519, Revised 1994), and repealed and replaced by the Central Bank of Malaysia Act 2009.',
      'The first annual report, published in 1959, was **17 pages long** and covered a staff of **67 people**. The museum calls it the start of a transparency tradition that continues today.',
      'The gallery is organised as eras: 1955–1974 *Planting the Seeds*; 1980–1993 *Building Momentum*, when manufacturing reduced dependence on rubber and tin; 1994–1999 *Foundational Facelift*, dominated by the [[asian-financial-crisis]].',
    ],
    seeAlso: ['bnm-mandate', 'kijang-coin', 'ringgit', 'asian-financial-crisis', 'sasana-kijang'],
  },
  {
    slug: 'bnm-mandate',
    title: 'The mandate',
    category: 'institution',
    summary:
      'Monetary stability and financial stability, conducive to the sustainable growth of the Malaysian economy. That is the entire job.',
    body: [
      'Carved into a stone wall in the gallery, quoted from the **Central Bank of Malaysia Act 2009**: *"The principal objects of the Bank shall be to promote monetary stability and financial stability conducive to the sustainable growth of the Malaysian economy."*',
      'Everything else in the building is downstream of that sentence: currency issuance (see [[ringgit]]), payment system oversight (see [[epayments]]), supervision of licensed institutions (see [[regulation]]), and the codified [[dual-system|dual financial system]].',
      'It is worth noticing what is *not* in the mandate: promoting any particular technology, or protecting any incumbent. The test a proposal has to pass is stability plus sustainable growth.',
    ],
    angle:
      'If you are writing the contest essay, write to this sentence. An argument that a blockchain application improves monetary or financial stability, or supports sustainable growth, is an argument this institution is statutorily obliged to care about. An argument that it is exciting is not.',
    seeAlso: ['bnm-history', 'regulation', 'dual-system', 'epayments'],
  },
  {
    slug: 'regulation',
    title: 'Supervision, and where digital assets sit',
    category: 'institution',
    summary:
      'Risk-based supervision of licensed institutions — plus, as of 2026, live ringgit stablecoin and tokenised deposit pilots.',
    body: [
      '**The museum\'s framing.** One of Bank Negara\'s most important duties is ensuring the nation\'s financial institutions serve customers honestly and efficiently. It is empowered under a variety of Acts to license, regulate, inspect and, if necessary, investigate banks, insurers and other financial institutions. A **Risk Based Supervisory Framework** assesses licensed institutions across credit, market, liquidity and operational risk, through supervisory planning, off-site surveillance, on-site visits and follow-up.',
      '**Where digital assets sit, as of 2026.** Bank Negara has onboarded three initiatives under its **Digital Asset Innovation Hub (DAIH)** to test ringgit stablecoins and tokenised deposits in real-world use, focused on wholesale payment use cases both domestic and cross-border, including settlement of tokenised assets. A ringgit-based stablecoin for B2B settlement is led jointly by Standard Chartered Bank Malaysia and Capital A; tokenised deposit projects are led by Maybank and CIMB. Some use cases explicitly explore Shariah considerations (see [[islamic-finance]]). BNM has said it intends to give greater clarity on ringgit stablecoins and tokenised deposits by end-2026.',
      '**The securities side.** The Securities Commission Malaysia regulates Digital Asset Exchanges (DAX) under its Guidelines on Recognized Markets. A revised framework took effect **20 May 2026**, streamlining product approvals for registered operators while raising requirements on financial stability, shareholding structure, management competency, governance and client-asset safeguards. All DAX operators become members of the Financial Markets Ombudsman Service from 2026. The SC has taken administrative action against unregistered exchanges and, from 14 April 2026, worked with platforms including Google to restrict unregistered operators from advertising to Malaysians. Trading value on regulated DAXs reached RM17.14 billion in 2025, up 23% from RM13.93 billion in 2024.',
      'So the honest picture for an essayist: Malaysia is neither a crypto free-for-all nor a prohibition regime. It is a two-regulator, licence-based jurisdiction actively piloting tokenised money inside a sandbox.',
    ],
    angle:
      'Any essay claiming Malaysia "should adopt blockchain" needs to reckon with the fact that its central bank is already running ringgit stablecoin pilots. The interesting question is no longer whether, but which use cases, under which of the two regulators, and with what settlement asset.',
    seeAlso: ['bnm-mandate', 'epayments', 'dual-system', 'sukuk', 'fintech'],
    sources: [
      {
        label: 'BNM onboards ringgit stablecoin and tokenised deposit pilots',
        url: 'https://www.theasianbanker.com/press-releases/bank-negara-malaysia-onboards-ringgit-stablecoin-and-tokenised-deposit-pilots-under-digital-asset-innovation-hub',
      },
      {
        label: 'SC issues revised Guidelines on Recognized Markets for DAX',
        url: 'https://www.sc.com.my/resources/media/media-release/sc-issues-revised-guidelines-on-recognized-markets-for-digital-asset-exchange',
      },
    ],
  },
  {
    slug: 'asian-financial-crisis',
    title: 'The Asian Financial Crisis',
    category: 'institution',
    summary:
      'The 1997–98 shock that the museum describes the Bank meeting as “a beacon of light… entering unchartered waters.”',
    body: [
      'The 1994–1999 panel is candid: the decade was mostly a period of institutional improvement, "however, the decade was challenged by the Asian Financial Crisis where Bank Negara Malaysia was tasked to become a beacon of light as the country entered unchartered waters for recovery."',
      'The crisis began with the collapse of the Thai baht in July 1997 and spread through the region as capital fled. The ringgit fell sharply; the Kuala Lumpur stock market lost most of its value. Malaysia\'s policy response diverged from its neighbours: rather than accept an IMF programme, it imposed selective capital controls in September 1998 and pegged the ringgit at RM3.80 to the US dollar, a peg maintained until 2005.',
      'The museum notes that after the crisis Malaysia experienced an economic boom and rapid development driven partly by advances in the industrial sector (see [[semiconductors]]).',
      'The crisis is the reason a great deal of the supervisory apparatus described under [[regulation]] exists in its current form.',
    ],
    angle:
      'Institutional memory here is of capital flight and currency instability, met with capital controls. That is important context for any proposal involving permissionless cross-border value transfer.',
    seeAlso: ['bnm-history', 'regulation', 'malaysia-economy', 'international-trade'],
  },

  // ────────────────────────── THE MALAYSIAN ECONOMY ──────────────────────────
  {
    slug: 'malaysia-economy',
    title: 'Malaysia’s economic transformation',
    category: 'economy',
    summary:
      'From commodity dependence to a diversified, open economy with trade worth more than 100% of GDP.',
    body: [
      'The Economics Gallery tells one story across a whole floor: "The Malaysian economy has undergone a dramatic transformation from its dependence on agriculture and commodity exports, to a more diversified and open economy with strong links to global value chains."',
      'The **Progress of a Nation** wall marks the decades — Era Pembangunan (1960s), Era Perpaduan (1970s), Era Perindustrian (1980s), Era Permodenan (1990s), Milenium Baru (2000s) — each with a newspaper front page and a telephone handset you pick up to hear it. The summary: "Since independence, the Malaysian economy has successfully developed from a low income to an upper middle-income economy… a story of well-planned economic strategies and clear long-term visions, while learning from past challenges."',
      'The manufacturing shift is dated precisely: the sector began to grow rapidly in the early 1980s, when the country recognised it needed to reduce dependence on imports. Today manufacturing is still one of the fastest-growing industries and a substantial contributor to growth.',
      'The gallery is also unusually good at meeting people where they are. Instead of opening with definitions, it opens with the questions people actually ask: *"Why does my RM100 feel small now?"*, *"Cukup tak gaji RM2,700 hidup di KL?"*, *"Should I save or spend my money?"*, *"OPR keeps changing. Can\'t they be static?"* — see [[financial-literacy]].',
    ],
    seeAlso: ['commodities', 'international-trade', 'semiconductors', 'infrastructure', 'financial-literacy'],
  },
  {
    slug: 'commodities',
    title: 'Commodities: tin, rubber, palm oil, petroleum',
    category: 'economy',
    summary:
      'Coal, gold, tin from the 1820s, smuggled rubber seeds, and the Grand Old Lady well — the resource base of the old economy.',
    body: [
      'The **Komoditi** wall answers one question: what were Malaysia\'s main commodities prior to Independence?',
      '**Tin.** Mining began in the early 1820s. It is the reason the first railway line in Malaya was built (see [[infrastructure]]) and the reason [[pitis-money-tree|tin pitis]] were coinage here centuries earlier.',
      '**Rubber.** The panel is blunt: "Smuggled seeds change the course of history." By 1921 Malaya was producing half the world\'s total rubber supply. For decades Malaysia was among the largest producers of natural rubber in the world; more recently the sector diversified downstream into manufacturing, and today Malaysia is the world\'s largest supplier of rubber gloves.',
      '**Coal and gold.** Coal played a major role in fuelling Malaya\'s economy; gold has been mined here for centuries.',
      '**Oil and gas.** The first oil well — the **Grand Old Lady** in Miri, Sarawak — was drilled by Shell and produced 83 barrels a day in its early years, reaching a maximum of 15,000 barrels a day in 1929. There were no other drilling activities in Borneo or Peninsular Malaya until the 1950s. **PETRONAS** was incorporated on 17 August 1974, vested with ownership and control of Malaysia\'s petroleum resources.',
      '**Palm oil.** The oil palm industry expanded rapidly only in the 1960s, encouraged by the government as a complementary crop to rubber, and quickly became one of the major resource-based industries. The museum grows an actual oil palm trunk out of the gallery floor next to a panel on **biodiesel** — a renewable diesel substitute made from vegetable oils, in which palm oil is a key input.',
      '**Petrochemicals** — chemical products derived from petroleum and natural gas, feeding plastics, paints and cosmetics — mark the move from importer to exporter.',
    ],
    angle:
      'Commodity supply chains are the most concrete, least hand-wavy blockchain use case available to Malaysia: palm oil traceability and deforestation-free certification, rubber provenance, and petroleum settlement. If you want a specific, defensible essay, this is where the specificity lives.',
    seeAlso: ['malaysia-economy', 'international-trade', 'infrastructure', 'malacca'],
  },
  {
    slug: 'international-trade',
    title: 'Trade worth more than the whole economy',
    category: 'economy',
    summary:
      'Malaysian trade accounts for over 100% of GDP, with links to more than 180 countries.',
    body: [
      'The **Malaysia in the Global Economy** panel makes a claim worth reading twice: "Currently, Malaysia is a significant trading nation, with trade accounting for **over 100% of GDP** and with extensive linkages with over **180 countries** in the world."',
      'That is possible because imports and exports are summed, and because much of what passes through is intermediate goods in global value chains — components in, assemblies out (see [[semiconductors]]).',
      'The **International Trade** exhibit stages this as a mock container ship, the *MV Economy*, with labelled containers visitors open to see what Malaysia actually trades with each major partner. "Malaysia\'s activity in international trade extends to almost every country on the planet. We export and import innumerable products, from raw materials to finished goods."',
      'The history is continuous: this is the same geography that made [[malacca]] the hinge of Indian Ocean trade and pulled every silver [[trade-dollars|trade dollar]] in Eurasia into the archipelago.',
    ],
    angle:
      'An economy where trade exceeds GDP has an outsized exposure to trade finance friction, letters of credit, customs documentation and cross-border settlement lag. That is a much stronger case for distributed ledgers than retail payments, where DuitNow already works well.',
    seeAlso: ['malaysia-economy', 'commodities', 'semiconductors', 'malacca', 'epayments'],
  },
  {
    slug: 'infrastructure',
    title: 'How the country was wired',
    category: 'economy',
    summary:
      'Power in Rawang, rail from Taiping to Port Weld in 1885, the telegraph in 1874, the ATUR 450 in 1985.',
    body: [
      'The **How we started** wall is a history of enabling infrastructure — the argument being that markets need physical preconditions.',
      '**Power.** Electricity first appeared in Malaysia at the turn of the 20th century; the earliest record of power generation traces to a small mining town in Rawang, Selangor. Before that, homes ran on kerosene lamps until electricity spread in the 1920s.',
      '**Rail.** The first railway line was built between **Taiping and Port Weld in 1885**, during the British colonial era — explicitly to speed the movement of tin from mining areas to coastal ports (see [[commodities]]).',
      '**Roads.** Driving on the left has been compulsory since motor vehicles were introduced in the Federated Malay States in 1903. The first tolled highway was the 20km Tanjung Malim–Slim River road, opened 16 March 1966; buses and lorries paid RM2, cars RM5 and motorcycles 50 sen.',
      '**Air.** Malayan Airways\' first flight left Singapore\'s Kallang Airport for Kuala Lumpur\'s Sungai Besi Airport with five passengers on **2 April 1947**. Malaysian Airline System was founded in 1947.',
      '**Communications.** Malaysia\'s first telephone (telegraph) line was installed in **1874**, linking the British Colonial Resident\'s Office in Perak with an administrative office 45km away. The first cellular phone used in Malaysia was the **ATUR 450**, by Telekom Malaysia, in **1985**.',
    ],
    angle:
      'Every one of these was built to reduce the cost of moving something — ore, people, messages. A payment network is the same category of object. The museum implicitly invites the comparison.',
    seeAlso: ['malaysia-economy', 'commodities', 'semiconductors', 'epayments'],
  },
  {
    slug: 'semiconductors',
    title: 'Semiconductors and Penang',
    category: 'economy',
    summary:
      'A 1970s state-government bet on export-processing zones that turned into one of Malaysia’s largest export categories.',
    body: [
      'The **Semiconductors — The Unsung Heroes of Technology** panel tells a compact industrial-policy story: "The Penang State Government launched Penang Electronics in the 1970s to symbolically promote the manufacturing of semiconductor materials, attracting firms such as Clarion (Japan), followed by National Semiconductor (USA). These firms were able to take advantage of the tax-free export-processing zones, and in turn create employment opportunities. Today, semiconductor materials are one of Malaysia\'s major exports."',
      'The consumer electronics industry began earlier, in **1965**, when Japanese investors entered the local market and started manufacturing for Malaysian consumers. The sub-sector is dominated by Japanese and Korean firms and remains a major contributor to national exports.',
      'The gallery displays a bare circuit board and a ceramic Atmel package at the end of a gold-lit tunnel — an ordinary object presented as a national asset, which in export-earnings terms it is.',
      'The **Services Sector** panel marks the next phase: as Malaysia moves toward developed-nation status, emphasis shifts to services as the growth engine.',
    ],
    angle:
      'Malaysia is deep in the physical layer of computing — assembly, test and packaging — while most blockchain discourse lives at the application layer. There is an underwritten essay in what that vertical position is actually worth.',
    seeAlso: ['malaysia-economy', 'international-trade', 'infrastructure', 'commodities'],
  },
  {
    slug: 'financial-literacy',
    title: 'Financial literacy, asked properly',
    category: 'economy',
    summary:
      'The Economics Gallery opens with the questions people actually mutter, not with definitions.',
    body: [
      'The best piece of exhibition design in the museum is a wall of real questions in Malay, English and Manglish: *"Kenapa harga barang kadang-kadang NAIK?"*, *"Cukup tak gaji RM2,700 hidup di KL?"*, *"What is GDP?"*, *"Should I save or spend my money?"*, *"OPR keeps changing. Can\'t they be static?"*, *"Oh-oh! Are we in crisis?"*, *"Why does my RM100 feel small now?"*, *"Kualiti hidup saya sekarang makin selesa, LAH!"*',
      'One of them is a data point in its own right: *"I trust e-Payment more now for my daily transactions."* That is the museum recording a shift in public confidence as an achievement (see [[epayments]]).',
      'Hinged panels elsewhere teach concepts through situations: water prices at a crowded stadium (scarcity), a year of national activity summed up (GDP), foreign purchases of palm oil and electronics (export demand), bubble tea going from RM7 to RM9 (inflation), and RM100 buying different amounts of USD on different days (exchange rates).',
      'It is a useful standard. Explaining a system in the terms of the person using it, rather than the person who built it, is exactly what most writing about blockchain fails to do.',
    ],
    angle:
      'If you cannot phrase your blockchain proposal as an answer to one of these questions, it probably is not a proposal about Malaysia.',
    seeAlso: ['malaysia-economy', 'epayments', 'fintech'],
  },
  {
    slug: 'fintech',
    title: 'Fintech',
    category: 'economy',
    summary:
      'Defined by the museum as the application of technology in finance — and dated to the late 1800s, not the 2010s.',
    body: [
      'The **Apa itu Fintech? / What is Fintech?** wall gives a definition worth borrowing: "Fintech is the application of technology in finance. Fintech is any new technological innovation that competes with or precedes traditional financial methods, particularly the delivery of financial services."',
      '"At its core, Fintech is utilised to help companies, business owners and consumers to better manage their financial operations, processes, and lives by utilising specialised software and algorithms that are used on computers, and increasingly, smartphones."',
      'And then the line that reframes everything else in the building: "Although it is a relatively new term, technological innovation in finance has been **evident since the late 1800s** in one form or another. Banks, organisations, and governments are continually trying to improve financial technology and improve services for their customers and citizens."',
      'By that definition the [[cheques|cheque perforator]] from 1890s New York is fintech. So is the [[hawala-suftaja|suftaja]], the [[astrolabe]], and the 100-ton coining press.',
    ],
    angle:
      'The museum has already conceded the framing that blockchain advocates usually have to fight for — that financial technology is a continuous line, not a rupture. Use it. The strongest essays will place blockchain inside this lineage rather than outside it.',
    seeAlso: ['epayments', 'regulation', 'cheques', 'financial-literacy'],
  },
]

export const KNOWLEDGE_BY_SLUG: Record<string, KnowledgeEntry> = Object.fromEntries(
  KNOWLEDGE.map((entry) => [entry.slug, entry]),
)

export function knowledgeBySlug(slug: string): KnowledgeEntry | undefined {
  return KNOWLEDGE_BY_SLUG[slug]
}

export function knowledgeInCategory(category: KnowledgeCategory): KnowledgeEntry[] {
  return KNOWLEDGE.filter((entry) => entry.category === category)
}

/** Entries that link *to* `slug` from their body or seeAlso — the backlinks panel. */
export function backlinksFor(slug: string): KnowledgeEntry[] {
  const pattern = new RegExp(`\\[\\[${slug}(\\||\\]\\])`)
  return KNOWLEDGE.filter(
    (entry) =>
      entry.slug !== slug &&
      (entry.seeAlso.includes(slug) || entry.body.some((p) => pattern.test(p))),
  )
}
