import { NextResponse } from 'next/server'
import {
  CONTEST_DEADLINE_ISO,
  CONTEST_DEADLINE_LABEL,
  CONTEST_EVENT_ID,
  CONTEST_JUDGING,
  CONTEST_PRIZE,
  CONTEST_PRIZE_CHAIN,
  CONTEST_PROMPT,
  CONTEST_RULES,
  CONTEST_SKILL_URL,
  CONTEST_SUBMIT_API,
  CONTEST_SUBTITLE,
  CONTEST_URL,
  CONTEST_WORDS_MAX,
  CONTEST_WORDS_MIN,
  contestIsClosed,
} from '@/lib/contest/config'
import { GALLERY_IMAGES, GALLERY_ROOMS, fullSrc, thumbSrc, videoSrc } from '@/lib/contest/gallery'
import { KNOWLEDGE } from '@/lib/contest/knowledge'
import {
  MYBW,
  MYBW_ESSAY_PICKS,
  MYBW_LOCAL_ECOSYSTEM,
  MYBW_MARKET_FACTS,
  MYBW_SCALE,
  MYBW_SESSIONS,
  MYBW_SOURCES,
  MYBW_STAGES,
} from '@/lib/contest/mybw'

export const dynamic = 'force-dynamic'

const SITE = 'https://myargoquest.com'

/**
 * The whole research corpus behind /mybw2026-contest as one JSON document:
 * contest rules, the cross-linked knowledge base, and every photograph with its
 * caption and transcribed signage. Consumed by agents that load
 * /mybw2026-contest/skill.md.
 *
 * `?include=knowledge|images|rules|mybw` narrows the payload.
 */
export async function GET(req: Request) {
  const include = new URL(req.url).searchParams.get('include')
  const want = (key: string) => !include || include.split(',').includes(key)

  const payload: Record<string, unknown> = {
    contest: {
      event: CONTEST_EVENT_ID,
      url: CONTEST_URL,
      skill: CONTEST_SKILL_URL,
      prompt: CONTEST_PROMPT,
      requiredSubtitle: CONTEST_SUBTITLE,
      wordCount: { min: CONTEST_WORDS_MIN, max: CONTEST_WORDS_MAX },
      prize: CONTEST_PRIZE,
      prizeChain: CONTEST_PRIZE_CHAIN,
      deadline: { iso: CONTEST_DEADLINE_ISO, label: CONTEST_DEADLINE_LABEL },
      closed: contestIsClosed(),
      judging: CONTEST_JUDGING,
      submitApi: CONTEST_SUBMIT_API,
      openToEveryone: true,
    },
  }

  if (want('rules')) payload.rules = CONTEST_RULES

  if (want('knowledge')) {
    payload.knowledge = KNOWLEDGE.map((e) => ({
      slug: e.slug,
      title: e.title,
      category: e.category,
      summary: e.summary,
      body: e.body,
      angle: e.angle ?? null,
      seeAlso: e.seeAlso,
      sources: e.sources ?? [],
      imageIds: GALLERY_IMAGES.filter((i) => i.topics.includes(e.slug)).map((i) => i.id),
    }))
  }

  if (want('mybw')) {
    payload.mybw = {
      ...MYBW,
      scale: MYBW_SCALE,
      stages: MYBW_STAGES,
      sessions: MYBW_SESSIONS,
      essayPicks: MYBW_ESSAY_PICKS,
      marketFacts: MYBW_MARKET_FACTS,
      localEcosystem: MYBW_LOCAL_ECOSYSTEM,
      sources: MYBW_SOURCES,
    }
  }

  if (want('images')) {
    payload.rooms = GALLERY_ROOMS
    payload.images = GALLERY_IMAGES.map((i) => ({
      id: i.id,
      kind: i.kind,
      room: i.room,
      title: i.title,
      caption: i.caption,
      text: i.text ?? null,
      topics: i.topics,
      shotAt: i.shotAt,
      width: i.width,
      height: i.height,
      // For a video, `thumb`/`full` are the poster frame.
      thumb: `${SITE}${thumbSrc(i.id)}`,
      full: `${SITE}${fullSrc(i.id)}`,
      ...(i.kind === 'video'
        ? { video: `${SITE}${videoSrc(i.id)}`, durationSec: i.durationSec ?? null }
        : {}),
    }))
  }

  return NextResponse.json(payload, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
