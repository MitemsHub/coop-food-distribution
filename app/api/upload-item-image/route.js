import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { createClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('image')
    const sku = formData.get('sku')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 5MB allowed.' },
        { status: 400 }
      )
    }

    const typeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const namePart = (file.name || '')
    const nameExt = namePart.includes('.') ? namePart.split('.').pop()?.toLowerCase() : ''
    const fileExtension = nameExt || typeToExt[file.type] || 'jpg'
    
    // Create filename using SKU
    const filename = `${sku}.${fileExtension}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Try Supabase Storage first (serverless-friendly). Fallback to local filesystem in dev.
    try {
      const supabase = createClient()
      const bucket = process.env.ITEM_IMAGES_BUCKET || 'item-images'
      const path = `items/${filename}`

      // Ensure bucket exists and is public
      const { data: bucketInfo, error: bucketInfoErr } = await supabase.storage.getBucket(bucket)
      if (bucketInfoErr || !bucketInfo) {
        await supabase.storage.createBucket(bucket, { public: true })
      }

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })
      if (!upErr) {
        const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path)
        const publicUrl = pub?.publicUrl || ''
        if (publicUrl) {
          return NextResponse.json({ success: true, imageUrl: publicUrl, message: 'Image uploaded successfully' })
        }
      }
      // If upload failed, fall through to local filesystem
      console.warn('Supabase Storage upload failed or no public URL; falling back to local filesystem:', upErr?.message)
    } catch (e) {
      console.warn('Supabase Storage not available; falling back to local filesystem:', e?.message)
    }

    // Local filesystem fallback (works in dev, not in Vercel serverless)
    const uploadDir = join(process.cwd(), 'public', 'images', 'items')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)
    const imageUrl = `/images/items/${filename}`

    return NextResponse.json({ success: true, imageUrl, message: 'Image uploaded successfully' })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}