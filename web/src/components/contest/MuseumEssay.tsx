'use client'

import { imageById, thumbSrc, type GalleryImage } from '@/lib/contest/gallery'
import { knowledgeBySlug } from '@/lib/contest/knowledge'

/** Inline figure pulled from the gallery manifest so captions never drift. */
function Figure({ id, crop = false }: { id: string; crop?: boolean }) {
  const img: GalleryImage | undefined = imageById(id)
  if (!img) return null
  // Portrait photos are capped so a 3:4 frame doesn't swallow the whole viewport.
  const portrait = img.height > img.width
  return (
    <figure style={{ margin: '30px 0' }}>
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--hairline)',
          background: 'var(--surfaceAlt)',
          lineHeight: 0,
          maxWidth: portrait ? 420 : undefined,
          marginInline: portrait ? 'auto' : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbSrc(img.id)}
          alt={img.caption}
          width={img.width}
          height={img.height}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            ...(crop ? { aspectRatio: '4 / 3', objectFit: 'cover', height: '100%' } : {}),
          }}
        />
      </div>
      <figcaption
        style={{
          marginTop: 10,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--text3)',
          maxWidth: portrait ? 420 : undefined,
          marginInline: portrait ? 'auto' : undefined,
        }}
      >
        <b style={{ color: 'var(--text2)', fontWeight: 600 }}>{img.title}.</b> {img.caption}
      </figcaption>
    </figure>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="serif"
      style={{
        marginTop: 46,
        marginBottom: 14,
        fontSize: 27,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: 'var(--text)',
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 16, fontSize: 17.5, lineHeight: 1.72, color: 'var(--text2)' }}>{children}</p>
  )
}

function Topic({ slug, onOpenTopic, children }: { slug: string; onOpenTopic?: (s: string) => void; children: React.ReactNode }) {
  const entry = knowledgeBySlug(slug)
  if (!entry || !onOpenTopic) return <>{children}</>
  return (
    <button
      type="button"
      onClick={() => onOpenTopic(slug)}
      title={entry.summary}
      style={{
        color: 'var(--accentDeep)',
        fontWeight: 600,
        borderBottom: '1px solid rgba(185,107,51,0.32)',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

export default function MuseumEssay({ onOpenTopic }: { onOpenTopic?: (slug: string) => void }) {
  const T = (slug: string, label: string) => (
    <Topic slug={slug} onOpenTopic={onOpenTopic}>
      {label}
    </Topic>
  )

  return (
    <article style={{ maxWidth: 700 }}>
      <span className="eyebrow">Field notes · 30 July 2026</span>
      <h1
        className="serif"
        style={{
          marginTop: 14,
          fontSize: 'clamp(30px, 4.2vw, 42px)',
          lineHeight: 1.12,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}
      >
        A morning at the central bank museum
      </h1>
      <p style={{ marginTop: 18, fontSize: 19, lineHeight: 1.6, color: 'var(--text2)' }}>
        On the second morning of Malaysia Blockchain Week, a handful of us left the conference floor and
        went to look at money instead of talking about it. What follows is a walk through what is
        actually in the Bank Negara Malaysia Museum &amp; Art Gallery, and why several rooms in it read
        like an argument you were not expecting to find there.
      </p>

      <Figure id="img3263" />

      <P>
        The building is called {T('sasana-kijang', 'Sasana Kijang')}, on Jalan Dato Onn, about fifteen
        minutes from the conference venue depending on what the traffic is doing. Bank Negara Malaysia
        opened it in 2011 as a centre for learning and research rather than as a banking hall, and the
        museum occupies part of it. Admission is free, no booking is needed, and bags are not allowed
        inside — there are lockers at the door, but the storage area is not the kind of place you leave a
        hardware wallet. You walk in under an atrium with a spiral staircase modelled on a nautilus shell.
      </P>

      <P>
        We started, as everyone does, with the fold-out guide. It maps{' '}
        {T('museum-galleries', 'six permanent galleries')} across four levels: the Art Gallery, the
        Numismatics Gallery and a rotating Temporary Gallery on Level 3; the Bank Negara Malaysia Gallery,
        the Economics Gallery and the Islamic Finance Gallery below; and a Children&apos;s Gallery on the
        ground floor built around the idea of &ldquo;Save, Spend and Share.&rdquo; We had ninety minutes.
        We managed four of the six.
      </P>

      <Figure id="img3147" />

      <H2>The Economics Gallery, or: how a country earns a living</H2>

      <P>
        The first thing the Economics Gallery does is refuse to define anything. Instead of opening with
        a panel about gross domestic product, it opens with a wall of the questions people actually ask,
        in Malay, English and Manglish. <i>Why does my RM100 feel small now?</i>{' '}
        <i>Cukup tak gaji RM2,700 hidup di KL?</i> <i>OPR keeps changing. Can&apos;t they be static?</i>{' '}
        <i>Should I save or spend my money?</i> One of them is not a question at all —{' '}
        <i>I trust e-Payment more now for my daily transactions</i> — which is a central bank recording a
        shift in public confidence and quietly filing it as an achievement.
      </P>

      <Figure id="img3159" />

      <P>
        From there it tells one long story about {T('malaysia-economy', 'transformation')}: a dependence
        on agriculture and commodity exports giving way to a diversified, open economy plugged into global
        value chains. The {T('commodities', 'commodities')} wall covers what came before independence —
        coal, gold, tin from the 1820s, and rubber, introduced by seeds that the museum describes without
        euphemism as smuggled. By 1921 Malaya was producing half the world&apos;s rubber. The first oil
        well, the Grand Old Lady in Sarawak, managed eighty-three barrels a day in its early years and
        fifteen thousand by 1929. An oil palm trunk grows out of the gallery floor next to a panel arguing
        for palm-derived biodiesel.
      </P>

      <P>
        Then the pivot: {T('semiconductors', 'semiconductors')}. In the 1970s the Penang state government
        launched Penang Electronics, tax-free export-processing zones pulled in Clarion from Japan and
        National Semiconductor from the United States, and half a century later semiconductor materials
        are one of Malaysia&apos;s largest exports. There is a bare circuit board and a ceramic Atmel chip
        at the end of a gold-lit tunnel, presented with the reverence usually reserved for a reliquary.
        Which, in a museum about how the country earns money, is roughly correct.
      </P>

      <Figure id="img3184" />

      <P>
        A quieter room covers {T('infrastructure', 'infrastructure')} — the physical preconditions for any
        market at all. Electricity first showed up at the turn of the twentieth century in a mining town in
        Rawang. The first railway ran from Taiping to Port Weld in 1885, built specifically to move tin to
        the coast. The first telephone line was strung in 1874, forty-five kilometres of it, connecting a
        colonial Resident&apos;s office in Perak to an administrative one. The first cellular phone used in
        Malaysia was the ATUR 450, in 1985. Every one of these is a machine for reducing the cost of moving
        something. It is not a stretch to put a payment network in the same category.
      </P>

      <P>
        The number that stops you is on a gold globe: Malaysian{' '}
        {T('international-trade', 'trade accounts for over 100% of GDP')}, with links to more than 180
        countries. Read that twice. The country moves more value across its borders than it produces
        inside them.
      </P>

      <H2>The Numismatics Gallery, or: money before anyone was in charge of it</H2>

      <P>
        Downstairs, the money itself. It begins with{' '}
        {T('pitis-money-tree', 'a pair of iron moulds from Kelantan')} and the branching tin
        &ldquo;money tree&rdquo; they cast — a technique the label credits to Tang-dynasty China, which
        tells you how long this peninsula has been a node on somebody else&apos;s trade route.
      </P>

      <Figure id="img3154" />

      <P>
        But the room that stayed with me is the {T('trade-dollars', 'trade dollar')} room. For centuries
        the Malay Archipelago ran on an arrangement that sounds, described plainly, quite radical: there
        was no issuer monopoly. The trading community accepted <i>any</i> silver crown weighing at least
        415 grains at ninety per cent fineness. Spanish Pillar Dollars, Mexican pesos, British Crowns,
        Hong Kong dollars, Japanese Meiji yen, French Indo-China piastres — all of it circulated
        side by side, valued by metal content rather than by whose face was on the front.
      </P>

      <P>
        Locals renamed everything. The Spanish Pillar Dollar became <i>Ringgit Tua</i>, the old ringgit.
        The Japanese yen became <i>Ringgit Muda</i>, the young one. The Mexican eagle coin became{' '}
        <i>Ringgit Garuda</i> or <i>Ringgit Burung</i>; its sunburst variant, <i>Ringgit Matahari</i>. The
        British trade dollar became <i>Ringgit Tongkat</i> — staff ringgit — because Britannia is holding
        a trident. And the word <i>ringgit</i> itself simply means jagged, after the milled edges of the
        Spanish coins. Malaysia&apos;s currency is named after the serrations on a foreign coin.
      </P>

      <Figure id="img3174" />

      <P>
        The French Indo-China piastre of 1898 is the one a cryptographer would linger on. Stamped across
        its obverse: <b>TITRE 0.900, POIDS 27 GR.</b> The coin publishes its own specification. You do not
        have to trust the issuer, or even read the language — you can weigh it and assay it and check the
        claim against the object. A multi-issuer currency system where acceptance rests on verifiable
        physical properties rather than institutional identity is not a thought experiment here. It is what
        this region did for three hundred years. It worked, and it also imposed a constant, grinding{' '}
        {T('verification', 'verification cost')} on everyone who touched it, which is exactly what the
        Safavid weighing scales two rooms over were for.
      </P>

      <P>
        The gallery ends where a money museum has no obligation to end: with{' '}
        {T('cheques', 'the history of the cheque')} and then with{' '}
        {T('epayments', 'the migration away from cash')}. The cheque section is a small demolition of the
        idea that payment instruments are modern. Romans used <i>praescriptiones</i> on wooden tablets.
        The Maurya Empire used the <i>adesha</i>, an order on a banker to pay a third party. Persian banks
        issued letters of credit called <i>chak</i> around 300 CE, which is where the word comes from. And
        the Elements of a Cheque display is, straightforwardly, a protocol specification: eleven numbered
        fields, each doing one job, plus a physical anti-tamper mechanism in the form of a perforator from
        1890s New York that punched permanently inked holes through the amount.
      </P>

      <Figure id="img3241" />

      <P>
        Then Bank Negara&apos;s own account of the 2010s, which is worth quoting because it is so
        unglamorous: it was &ldquo;an important decade for building the regulatory structure, e-payment
        infrastructure and public confidence for the transition towards e-payments.&rdquo; Three things,
        and the third is the hard one.
      </P>

      <H2>The Islamic Finance Gallery, or: the room that changes the essay</H2>

      <P>
        You enter through a lit cylinder wrapped in geometric strapwork that reads{' '}
        <i>Kewangan Islam Menjangkaui Dunia</i> — the world embraces{' '}
        {T('islamic-finance', 'Islamic finance')}. This is the room that will do the most work for anyone
        writing about blockchain in Malaysia, and it is worth being specific about why.
      </P>

      <Figure id="img3188" />

      <P>
        Three prohibitions organise everything: <i>riba</i>, interest; <i>gharar</i>, excessive uncertainty
        arising from deception or ignorance; and <i>maysir</i>, gambling. The{' '}
        {T('riba', 'panel on riba')} is more precise than the usual summary. The prohibition was a response
        to pre-Islamic money-lending in Mecca that let a lender <i>unilaterally increase the sum owed</i> if
        a borrower missed a payment. That is not a blanket objection to returns. It is an objection to one
        party rewriting an obligation after the fact — which is, functionally, a demand for contract
        immutability, and a rather elegant one.
      </P>

      <P>
        And then, in a glass case near the middle of the room, the object I did not expect. A{' '}
        {T('ledgers', 'handwritten Quran from Uzbekistan, dated 1354')}, open at verse 282 of Surah
        Al-Baqarah — the longest verse in the Quran, and the one about lending.
      </P>

      <Figure id="img3191" />

      <P>
        The translation on the label: <i>&ldquo;O believers! When you contract a debt from one another for
        a fixed period, put it (its amount and period of repayment) in writing. And let a scribe write it
        down between you justly (truthfully), and no scribe should refuse to write as Allah has taught
        him…&rdquo;</i> The museum spells out the requirements underneath: writing the contract is
        obligatory, it must be witnessed by someone trustworthy, and it applies regardless of how small the
        amount, with the repayment date recorded.
      </P>

      <P>
        Write it down. Record the amount. Record the maturity. Have it witnessed by a trusted party. Four
        requirements, arriving as religious obligation, in a manuscript seven hundred years old that is
        itself a copy of something far older. If you want a frame for arguing that a public, append-only,
        witnessed ledger is a continuation of something rather than a rupture from it, it is sitting in a
        vitrine on Jalan Dato Onn.
      </P>

      <P>
        The rest of the room keeps handing you the same kind of gift. The{' '}
        {T('hawala-suftaja', 'suftaja')} — a bill of exchange, displayed here as a Qajar-dynasty example
        from Iran — let one party issue a bearer instrument that another party would honour elsewhere,
        with the monetary agreement made beforehand, specifically to avoid the risk of physically
        transporting money. By the ninth century, Arab traders could cash a <i>sakk</i> in China against
        funds held in Baghdad. <i>Sakk</i> is the root of &ldquo;cheque&rdquo;; its plural is{' '}
        <i>sukuk</i>.
      </P>

      <P>
        {T('takaful', 'Takaful')} was first described by a nineteenth-century scholar writing about a
        merchant who leased a ship and paid a sum called <i>sukra</i> to someone who would compensate him
        if the cargo were lost. Modern takaful works as a mutual pool: everyone contributes a{' '}
        <i>tabarru</i>, a donation, into a common fund managed by an operator, and claims are paid from
        the pool. Describe that to someone without using the word <i>takaful</i> and you have described a
        parametric on-chain insurance pool, with a better-documented rationale for why it is structured
        that way.
      </P>

      <Figure id="img3223" />

      <P>
        The historical thread lands in a specific institutional sequence. In 1959 Royal Professor Ungku
        Aziz submitted {T('tabung-haji', 'a memorandum')} about a real problem: Malays were saving for the
        Hajj by selling land, jewellery and livestock, and coming home poorer. Lembaga Tabung Haji was
        established in 1969 to let them save gradually into Shariah-compliant investments instead. Demand
        for more Islamic products grew, a National Steering Committee was formed in 1981, and the{' '}
        {T('bank-islam', 'Islamic Banking Act 1983')} took effect that April.
      </P>

      <P>
        Which produces the single most quotable fact in the building. The Central Bank of Malaysia Act
        2009 states that <b>&ldquo;the financial system in Malaysia shall consist of the conventional
        financial system and the Islamic financial system.&rdquo;</b> Not a carve-out, not a sandbox
        exemption — a statutory declaration that two parallel rule-sets both constitute the national
        financial system. Malaysia has already proven, at national scale and for four decades, that it can{' '}
        {T('dual-system', 'run two sets of rules over one financial system')} with shared infrastructure and
        shared supervision.
      </P>

      <P>
        The room finishes with the results. On 25 June 2002 Malaysia issued the first international Islamic
        sovereign {T('sukuk', 'sukuk')}, USD 600 million over five years, and other countries followed. A
        wall-height timeline lists the firsts that came after: the first ringgit sukuk by a foreign
        non-Islamic company, the first by a supranational, the first by a UK multinational, the first
        structure using airtime vouchers as the underlying asset. The Islamic money market turns over
        roughly RM1 billion a day.
      </P>

      <Figure id="img3229" />

      <H2>The Bank Negara Malaysia Gallery, or: why any of this exists</H2>

      <P>
        The last room is the institution&apos;s account of itself, and it makes its case in economic terms
        rather than patriotic ones. After the Second World War Malaya looked strong — the world&apos;s
        largest producer of rubber and tin — but roughly eighty per cent of export earnings came from those
        two commodities, so national fortunes tracked prices nobody here controlled. The monetary system was
        anchored to sterling and local banking was dominated by British banks financing trade rather than
        development. In 1955 the IBRD was asked how a young country should manage monetary stability; the
        resulting Watson-Caine Report argued for a central bank. The Ordinance passed on 23 October 1958,
        and {T('bnm-history', 'Bank Negara Tanah Melayu opened on 26 January 1959')}. Its first annual
        report was seventeen pages long and covered a staff of sixty-seven.
      </P>

      <Figure id="img3257" />

      <P>
        The {T('kijang-coin', 'logo')} has its own panel, and it is a small masterpiece of institutional
        signalling. In 1964 the first Malaysian Governor, Tun Ismail Mohamed Ali, chose as the basis for the
        Bank&apos;s crest a gold coin from Kelantan minted somewhere between the thirteenth and sixteenth
        centuries, stamped with a barking deer — a <i>kijang</i>. He picked it partly because, unlike almost
        every other early coin from the peninsula, which carried only Jawi script, this one carried an image.
        A new central bank in a new country reached back past the colonial currencies, past the trade
        dollars, to a pre-national coin, and made it the mark of the institution. The building we spent the
        morning in is named after it.
      </P>

      <P>
        And on a stone wall, cut in large letters, the whole job in one sentence, quoted from the 2009 Act:{' '}
        {T('bnm-mandate', '“The principal objects of the Bank shall be to promote monetary stability and financial stability conducive to the sustainable growth of the Malaysian economy.”')}
      </P>

      <Figure id="img3254" />

      <H2>What we took away</H2>

      <P>
        You do not go to a central bank museum expecting it to argue your side. This one mostly does not —
        and that is what makes it useful. It never mentions blockchain. What it does instead is lay out, room
        by room, a thousand years of people solving the same four problems: how to record an obligation, how
        to verify a claim without trusting the claimant, how to move value without moving the thing, and how
        to share risk without exploiting anyone.
      </P>

      <P>
        The fintech wall is generous enough to concede the framing outright:{' '}
        {T('fintech', 'technological innovation in finance has been evident since the late 1800s')} in one
        form or another. On that definition, the cheque perforator is fintech. So is the astrolabe, the
        assay scale, the suftaja and the hundred-ton coining press.
      </P>

      <P>
        Which leaves the honest version of the question the{' '}
        {T('essay-contest', 'essay contest')} asks. Malaysia is not a jurisdiction waiting to be told about
        distributed ledgers. Its central bank is already running{' '}
        {T('regulation', 'ringgit stablecoin and tokenised deposit pilots')}, its securities regulator
        revised its digital asset exchange framework in May 2026, and its retail payment rails already work
        well. The interesting question is not whether. It is which specific problem, under which regulator,
        with what settlement asset, and answering to a mandate that only cares about two things.
      </P>

      <P>
        The knowledge base tab has everything we transcribed off the walls, cross-linked, with sources. It is
        there to be raided.
      </P>
    </article>
  )
}
