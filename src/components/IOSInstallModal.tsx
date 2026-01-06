interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Instalar en iPhone/iPad</h2>

        <div className="install-steps">
          <div className="install-step">
            <span className="step-number">1</span>
            <p>
              Toca el icono de compartir{" "}
              <span className="share-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z" />
                </svg>
              </span>{" "}
              en la barra del navegador
            </p>
          </div>

          <div className="install-step">
            <span className="step-number">2</span>
            <p>Desliza hacia abajo y selecciona "Agregar a inicio"</p>
          </div>

          <div className="install-step">
            <span className="step-number">3</span>
            <p>Toca "Agregar" en la esquina superior derecha</p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}
