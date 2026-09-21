import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';
import logo from '../assets/logo.png';

/**
 * Página pública (sem autenticação) para exibição do QR Code do dia.
 * Destinada a tablets colocados na entrada do tatame.
 * Acesso: /qr
 */
export default function QRDisplayPublic() {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeToRefresh, setTimeToRefresh] = useState('');
    const [pulseAnim, setPulseAnim] = useState(false);

    const loadQRCode = useCallback(async () => {
        setLoading(true);
        setError(null);
        // Chama via anon key (sem autenticação) — RPC usa SECURITY DEFINER
        const { data, error } = await supabase.rpc('get_or_create_daily_qr');
        if (error) {
            setError('Não foi possível carregar o código. Refresca a página.');
        } else {
            setQrCode(data);
            // Efeito de pulse ao atualizar
            setPulseAnim(true);
            setTimeout(() => setPulseAnim(false), 600);
        }
        setLoading(false);
    }, []);

    // Countdown até renovação + auto-reload à meia-noite/01:00
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const todayRenew = new Date();
            todayRenew.setHours(1, 0, 0, 0);
            const tomorrow = new Date(todayRenew);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const target = now < todayRenew ? todayRenew : tomorrow;
            const diff = target.getTime() - now.getTime();

            if (diff <= 1000) {
                // Hora de renovar — recarregar o código
                loadQRCode();
            }

            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeToRefresh(
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [loadQRCode]);

    useEffect(() => {
        loadQRCode();
    }, [loadQRCode]);

    return (
        <div className="qr-public-page">
            {/* Fundo animado */}
            <div className="qr-bg-orb qr-bg-orb-1" />
            <div className="qr-bg-orb qr-bg-orb-2" />

            <div className="qr-public-card">
                {/* Logo */}
                <div className="qr-pub-brand">
                    <div className="qr-pub-logo-ring">
                        <img src={logo} alt="ZR Team" className="qr-pub-logo" />
                    </div>
                    <h1 className="qr-pub-title">ZR TEAM</h1>
                    <p className="qr-pub-subtitle">BRAZILIAN JIU-JITSU</p>
                </div>

                {/* Instrução */}
                <div className="qr-pub-instruction">
                    <span>Faz check-in aqui:</span>
                </div>

                {/* QR Code */}
                <div className="qr-pub-code-area">
                    {loading ? (
                        <div className="qr-pub-loading">
                            <RefreshCw size={56} className="qr-pub-spin" />
                            <p>A carregar...</p>
                        </div>
                    ) : error ? (
                        <div className="qr-pub-error">
                            <p>{error}</p>
                            <button className="qr-pub-retry-btn" onClick={loadQRCode}>
                                <RefreshCw size={20} /> Tentar novamente
                            </button>
                        </div>
                    ) : qrCode ? (
                        <div className={`qr-pub-frame ${pulseAnim ? 'qr-pulse' : ''}`}>
                            <QRCodeSVG
                                value={qrCode}
                                size={300}
                                bgColor="#ffffff"
                                fgColor="#0a1628"
                                level="M"
                                includeMargin={true}
                            />
                        </div>
                    ) : null}
                </div>

                {/* Footer — renovação */}
                <div className="qr-pub-footer">
                    <div className="qr-pub-renew">
                        <span className="qr-pub-renew-label">Código renova às 01:00 · Faltam</span>
                        <span className="qr-pub-renew-timer">{timeToRefresh}</span>
                    </div>
                    <p className="qr-pub-hint">Aponta a câmera do teu telemóvel para o código acima</p>
                </div>
            </div>

            <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .qr-public-page {
          min-height: 100vh;
          background: radial-gradient(ellipse at 30% 20%, #0d2b1e 0%, #061412 40%, #020d0c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .qr-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.15;
        }
        .qr-bg-orb-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #10b981, transparent 70%);
          top: -150px;
          left: -150px;
          animation: orb-drift 12s ease-in-out infinite alternate;
        }
        .qr-bg-orb-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, #059669, transparent 70%);
          bottom: -100px;
          right: -100px;
          animation: orb-drift 15s ease-in-out infinite alternate-reverse;
        }
        @keyframes orb-drift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(30px, 20px) scale(1.1); }
        }

        .qr-public-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.75rem;
          z-index: 1;
          max-width: 500px;
          width: 100%;
        }

        .qr-pub-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
        .qr-pub-logo-ring {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          border: 2px solid rgba(16, 185, 129, 0.4);
          padding: 6px;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.05);
          animation: logo-breathe 4s ease-in-out infinite;
        }
        @keyframes logo-breathe {
          0%, 100% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.05); }
          50% { box-shadow: 0 0 50px rgba(16, 185, 129, 0.3), inset 0 0 30px rgba(16, 185, 129, 0.1); }
        }
        .qr-pub-logo {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          background: white;
        }
        .qr-pub-title {
          color: white;
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-shadow: 0 2px 20px rgba(16, 185, 129, 0.3);
        }
        .qr-pub-subtitle {
          color: rgba(16, 185, 129, 0.7);
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }

        .qr-pub-instruction {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 2rem;
          padding: 0.6rem 2rem;
        }
        .qr-pub-instruction span {
          color: rgba(255, 255, 255, 0.85);
          font-size: 1rem;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .qr-pub-code-area {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 340px;
        }
        .qr-pub-frame {
          padding: 1rem;
          background: white;
          border-radius: 1.25rem;
          box-shadow:
            0 0 0 4px rgba(16, 185, 129, 0.3),
            0 0 0 8px rgba(16, 185, 129, 0.08),
            0 20px 60px rgba(0, 0, 0, 0.6);
          transition: transform 0.3s ease;
        }
        .qr-pub-frame:hover { transform: scale(1.01); }
        .qr-pulse {
          animation: qr-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes qr-pop {
          0% { transform: scale(0.95); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }

        .qr-pub-loading, .qr-pub-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          padding: 3rem;
        }
        .qr-pub-spin {
          animation: spin 1s linear infinite;
          color: rgba(16, 185, 129, 0.6);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .qr-pub-retry-btn {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 0.75rem;
          color: #10b981;
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .qr-pub-retry-btn:hover { background: rgba(16, 185, 129, 0.25); }

        .qr-pub-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          text-align: center;
        }
        .qr-pub-renew {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2rem;
          padding: 0.4rem 1.25rem;
        }
        .qr-pub-renew-label {
          color: rgba(255, 255, 255, 0.35);
          font-size: 0.78rem;
        }
        .qr-pub-renew-timer {
          color: rgba(16, 185, 129, 0.8);
          font-size: 1rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.06em;
        }
        .qr-pub-hint {
          color: rgba(255, 255, 255, 0.2);
          font-size: 0.75rem;
          max-width: 280px;
          line-height: 1.5;
        }

        @media (max-width: 480px) {
          .qr-pub-title { font-size: 1.7rem; }
          .qr-pub-logo-ring { width: 100px; height: 100px; }
          .qr-pub-frame svg { width: 240px !important; height: 240px !important; }
        }
      `}</style>
        </div>
    );
}
