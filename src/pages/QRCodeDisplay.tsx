import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { X, RefreshCw, Monitor } from 'lucide-react';
import logo from '../assets/logo.png';

interface QRCodeDisplayProps {
    onClose: () => void;
}

export default function QRCodeDisplay({ onClose }: QRCodeDisplayProps) {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeToRefresh, setTimeToRefresh] = useState('');

    const loadQRCode = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase.rpc('get_or_create_daily_qr');
        if (error) {
            setError('Erro ao carregar código QR: ' + error.message);
        } else {
            setQrCode(data);
        }
        setLoading(false);
    }, []);

    // Calcular tempo até renovação (01:00 AM do dia seguinte)
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(1, 0, 0, 0);
            // Se ainda não passou a 1:00 hoje, contar até hoje 01:00
            const todayRenew = new Date();
            todayRenew.setHours(1, 0, 0, 0);
            const target = now < todayRenew ? todayRenew : tomorrow;
            const diff = target.getTime() - now.getTime();
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeToRefresh(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadQRCode();
    }, [loadQRCode]);

    const openPublicPage = () => {
        window.open('/qr', '_blank');
    };

    return (
        <div className="qr-modal-overlay" onClick={onClose}>
            <div className="qr-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="qr-modal-header">
                    <button className="qr-close-btn" onClick={onClose} title="Fechar">
                        <X size={22} />
                    </button>
                    <button
                        className="qr-public-btn"
                        onClick={openPublicPage}
                        title="Abrir página pública (para tablet)"
                    >
                        <Monitor size={18} />
                        <span>Modo Tablet</span>
                    </button>
                </div>

                {/* Logo */}
                <div className="qr-brand">
                    <img src={logo} alt="ZR Team" className="qr-brand-logo" />
                    <h2 className="qr-brand-title">ZR TEAM</h2>
                    <p className="qr-brand-sub">Faz check-in aqui:</p>
                </div>

                {/* QR Code */}
                <div className="qr-code-wrapper">
                    {loading ? (
                        <div className="qr-loading">
                            <RefreshCw size={40} className="qr-spin" />
                            <p>A carregar código do dia...</p>
                        </div>
                    ) : error ? (
                        <div className="qr-error">
                            <p>{error}</p>
                            <button className="btn-qr-retry" onClick={loadQRCode}>
                                <RefreshCw size={16} /> Tentar novamente
                            </button>
                        </div>
                    ) : qrCode ? (
                        <div className="qr-code-frame">
                            <QRCodeSVG
                                value={qrCode}
                                size={240}
                                bgColor="#ffffff"
                                fgColor="#0a1628"
                                level="M"
                                includeMargin={true}
                            />
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="qr-footer">
                    <div className="qr-renew-info">
                        <span className="qr-renew-label">Código do dia — renova em</span>
                        <span className="qr-renew-timer">{timeToRefresh}</span>
                    </div>
                </div>
            </div>

            <style>{`
        .qr-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 1rem;
        }
        .qr-modal-card {
          background: linear-gradient(145deg, #0d1f2d, #0a1628);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 1.5rem;
          padding: 1.5rem;
          max-width: 380px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(16, 185, 129, 0.08);
          position: relative;
        }
        .qr-modal-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .qr-close-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          color: rgba(255,255,255,0.6);
          padding: 0.4rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        .qr-close-btn:hover { background: rgba(255,255,255,0.12); color: white; }
        .qr-public-btn {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.5rem;
          color: var(--primary);
          padding: 0.4rem 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .qr-public-btn:hover { background: rgba(16, 185, 129, 0.2); }

        .qr-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.4rem;
        }
        .qr-brand-logo {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 2px solid rgba(16, 185, 129, 0.5);
          padding: 3px;
          background: white;
        }
        .qr-brand-title {
          color: white;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0;
        }
        .qr-brand-sub {
          color: rgba(16, 185, 129, 0.85);
          font-size: 0.85rem;
          font-weight: 500;
          margin: 0;
          letter-spacing: 0.03em;
        }

        .qr-code-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 280px;
        }
        .qr-code-frame {
          padding: 0.75rem;
          background: white;
          border-radius: 1rem;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3), 0 8px 30px rgba(0,0,0,0.5);
        }
        .qr-loading, .qr-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: rgba(255,255,255,0.5);
          text-align: center;
        }
        .qr-spin {
          animation: spin 1s linear infinite;
          color: var(--primary);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .btn-qr-retry {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.5rem;
          color: var(--primary);
          padding: 0.5rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .qr-footer {
          width: 100%;
          border-top: 1px solid rgba(255,255,255,0.07);
          padding-top: 0.75rem;
        }
        .qr-renew-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .qr-renew-label {
          color: rgba(255,255,255,0.35);
          font-size: 0.72rem;
        }
        .qr-renew-timer {
          color: rgba(16, 185, 129, 0.7);
          font-size: 0.85rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
        }
      `}</style>
        </div>
    );
}
