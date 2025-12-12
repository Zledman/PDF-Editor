export default function LoadingSpinner({ message = 'Laddar...', size = 40 }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        gap: '20px'
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: `4px solid rgba(255, 255, 255, 0.3)`,
          borderTopColor: '#ff6b35',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}
      />
      {message && (
        <p style={{ color: '#fff', fontSize: '16px', margin: 0 }}>
          {message}
        </p>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

