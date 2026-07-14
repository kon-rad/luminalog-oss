// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const getCustomerInfo = vi.fn()
vi.mock('./revenuecat', () => ({
  PRO_ENTITLEMENT_ID: 'pro',
  BILLING_ENABLED: true,
  getPurchases: vi.fn(async () => ({ getCustomerInfo })),
}))

import { useEntitlement } from './useEntitlement'

describe('useEntitlement', () => {
  beforeEach(() => getCustomerInfo.mockReset())

  it('is loading with a null uid and never calls the SDK', () => {
    const { result } = renderHook(() => useEntitlement(null))
    expect(result.current.status).toBe('loading')
    expect(getCustomerInfo).not.toHaveBeenCalled()
  })

  it('reports active when the pro entitlement is present', async () => {
    getCustomerInfo.mockResolvedValue({ entitlements: { active: { pro: { identifier: 'pro' } } } })
    const { result } = renderHook(() => useEntitlement('uid_1'))
    await waitFor(() => expect(result.current.status).toBe('active'))
  })

  it('reports inactive when pro is absent', async () => {
    getCustomerInfo.mockResolvedValue({ entitlements: { active: {} } })
    const { result } = renderHook(() => useEntitlement('uid_1'))
    await waitFor(() => expect(result.current.status).toBe('inactive'))
  })
})
