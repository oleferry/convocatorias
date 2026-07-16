import { ImageResponse } from 'next/og'

export const ogSize = { width: 1200, height: 630 }

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#12312A',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(201,154,61,0.22), transparent 60%)',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 96, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ color: '#F1EFE6' }}>Dame</span>
          <span style={{ color: '#C99A3D' }}>Perras</span>
          <span style={{ color: '#F1EFE6' }}>Perro</span>
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#9CA79E', marginTop: 20 }}>
          El perro que encuentra las perras
        </div>
      </div>
    ),
    { ...ogSize }
  )
}
