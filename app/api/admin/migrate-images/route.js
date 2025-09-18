import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(request) {
  try {
    // Check if the image_url column already exists by trying to select from it
    const { error: columnCheckError } = await supabase
      .from('items')
      .select('image_url')
      .limit(1)

    // If no error, column exists
    if (!columnCheckError) {
      return NextResponse.json({
        success: true,
        message: 'Database migration already completed. The image_url column already exists in the items table.'
      })
    }

    // If column doesn't exist (error code 42703 = undefined column), we need to add it
    if (columnCheckError.code === '42703') {
      // Column doesn't exist, provide manual migration instructions
      return NextResponse.json({
        requiresManualMigration: true,
        message: 'Automatic migration failed. Please run the migration manually in Supabase SQL Editor.',
        instructions: [
          'Run the following SQL commands in your Supabase SQL Editor:',
          `-- Add image_url column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN items.image_url IS 'Relative path to item image (e.g., /images/items/RICE50KG.jpg)';

-- Create index for faster image queries
CREATE INDEX IF NOT EXISTS idx_items_image_url ON items(image_url) WHERE image_url IS NOT NULL;`
        ]
      })
    }

    // For any other error, also provide manual instructions
    console.error('Unexpected error checking column:', columnCheckError)
      
    return NextResponse.json({
      requiresManualMigration: true,
      message: 'Automatic migration failed. Please run the migration manually in Supabase SQL Editor.',
      instructions: [
        'Run the following SQL commands in your Supabase SQL Editor:',
        `-- Add image_url column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

-- Add comment for documentation  
COMMENT ON COLUMN items.image_url IS 'Relative path to item image (e.g., /images/items/RICE50KG.jpg)';

-- Create index for faster image queries
CREATE INDEX IF NOT EXISTS idx_items_image_url ON items(image_url) WHERE image_url IS NOT NULL;`
      ]
    })

  } catch (error) {
    console.error('Migration API error:', error)
    
    return NextResponse.json({
      requiresManualMigration: true,
      message: 'Automatic migration failed. Please run the migration manually in Supabase SQL Editor.',
      instructions: [
        'Run the following SQL commands in your Supabase SQL Editor:',
        `-- Add image_url column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN items.image_url IS 'Relative path to item image (e.g., /images/items/RICE50KG.jpg)';

-- Create index for faster image queries  
CREATE INDEX IF NOT EXISTS idx_items_image_url ON items(image_url) WHERE image_url IS NOT NULL;`
      ]
    })
  }
}