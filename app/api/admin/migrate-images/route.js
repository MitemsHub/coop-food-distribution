import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()

    // Test if the column already exists by trying to select it
    const { error: testError } = await supabase
      .from('items')
      .select('image_url')
      .limit(1)

    if (testError && testError.code === '42703') {
      // Column doesn't exist, provide manual migration instructions
      return NextResponse.json({
        success: false,
        requiresManualMigration: true,
        message: 'Database migration required - Please run the SQL commands below in your Supabase SQL Editor',
        instructions: [
          'Go to your Supabase Dashboard → SQL Editor',
          'Copy and paste this SQL command:',
          'ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);',
          'COMMENT ON COLUMN items.image_url IS \'Relative path to item image (e.g., /images/items/RICE50KG.jpg)\';',
          'CREATE INDEX IF NOT EXISTS idx_items_image_url ON items(image_url) WHERE image_url IS NOT NULL;',
          'Click "Run" to execute the commands',
          'Then refresh this page and try the migration button again'
        ]
      })
    } else if (testError) {
      // Some other error occurred
      return NextResponse.json({
        success: false,
        error: 'Database connection error',
        details: testError.message
      }, { status: 500 })
    }

    // Column exists, migration is complete
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully! The image_url column is ready to use.'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run migration'
  })
}