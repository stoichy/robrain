import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergePluginRecommendation } from './claude-plugin.js'

describe('mergePluginRecommendation', () => {
  it('creates settings from scratch when no file exists', () => {
    const { content, changed } = mergePluginRecommendation(null)
    assert.equal(changed, true)
    const s = JSON.parse(content)
    assert.deepEqual(s.extraKnownMarketplaces.robrain.source, { source: 'github', repo: 'adelinamart/robrain' })
    assert.equal(s.enabledPlugins['robrain@robrain'], true)
  })

  it('preserves unrelated keys and existing plugins', () => {
    const existing = JSON.stringify({
      permissions: { allow: ['Bash(pnpm test)'] },
      enabledPlugins: { 'other@somewhere': true },
    })
    const { content, changed } = mergePluginRecommendation(existing)
    assert.equal(changed, true)
    const s = JSON.parse(content)
    assert.deepEqual(s.permissions, { allow: ['Bash(pnpm test)'] })
    assert.equal(s.enabledPlugins['other@somewhere'], true)
    assert.equal(s.enabledPlugins['robrain@robrain'], true)
  })

  it('is idempotent when the recommendation is already present', () => {
    const first = mergePluginRecommendation(null)
    const second = mergePluginRecommendation(first.content)
    assert.equal(second.changed, false)
  })

  it('does not overwrite a user-defined robrain marketplace source', () => {
    const existing = JSON.stringify({
      extraKnownMarketplaces: { robrain: { source: { source: 'directory', path: '/dev/checkout' } } },
      enabledPlugins: { 'robrain@robrain': true },
    })
    const { changed } = mergePluginRecommendation(existing)
    assert.equal(changed, false)
  })

  it('leaves unparseable settings.json untouched', () => {
    const broken = '{ "permissions": '
    const { content, changed } = mergePluginRecommendation(broken)
    assert.equal(changed, false)
    assert.equal(content, broken)
  })

  it('leaves non-object settings.json untouched', () => {
    const { changed } = mergePluginRecommendation('[1,2,3]')
    assert.equal(changed, false)
  })
})
