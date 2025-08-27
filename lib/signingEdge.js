// lib/signingEdge.js
// Edge Runtime compatible signing functions using Web Crypto API

function encode(obj) {
  return new TextEncoder().encode(JSON.stringify(obj))
}

function decode(buffer) {
  return new TextDecoder().decode(buffer)
}

function base64urlEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  const binary = atob(str)
  return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)))
}

export async function sign(payload, expiresInSec = 60 * 60) {
  const secret = process.env.APP_SECRET || 'dev-secret-change-me'
  const exp = Math.floor(Date.now() / 1000) + expiresInSec
  const body = { ...payload, exp }
  
  const data = encode(body)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, data)
  const sigArray = new Uint8Array(signature)
  const sig = Array.from(sigArray).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const token = { b: body, s: sig }
  const tokenStr = JSON.stringify(token)
  return btoa(tokenStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function verify(token) {
  try {
    const secret = process.env.APP_SECRET || 'dev-secret-change-me'
    // Decode base64url token
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    const parsed = JSON.parse(atob(base64))
    
    const data = encode(parsed.b)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', key, data)
    const sigArray = new Uint8Array(signature)
    const computedSig = Array.from(sigArray).map(b => b.toString(16).padStart(2, '0')).join('')
    
    if (computedSig !== parsed.s) return null
    if (parsed.b.exp && parsed.b.exp < Math.floor(Date.now() / 1000)) return null
    
    return parsed.b
  } catch {
    return null
  }
}