import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle, XCircle, AlertTriangle, Camera, ArrowLeft } from 'lucide-react';

type ScanResult =
    | { type: 'success'; classTitle: string; startTime: string }
    | { type: 'already_done' }
    | { type: 'no_booking' }
    | { type: 'invalid_code' }
    | { type: 'error'; message: string }
    | null;

export default function QRScannerPage() {
    const { profile } = useOutletContext<{ profile: any }>();
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScanResult>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const processedRef = useRef(false); // Evitar processar o mesmo QR mais de uma vez

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                // 2 = SCANNING, 3 = PAUSED
                if (state === 2 || state === 3) {
                    await scannerRef.current.stop();
                }
            } catch {
                // Ignorar erros ao parar (já pode ter parado)
            }
            scannerRef.current = null;
        }
        setScanning(false);
    }, []);

    const handleQRSuccess = useCallback(async (decodedText: string) => {
        if (processedRef.current || loading) return;
        processedRef.current = true;

        await stopScanner();
        setLoading(true);
        setResult(null);

        const { data, error } = await supabase.rpc('qr_self_checkin', {
            qr_code_param: decodedText,
        });

        setLoading(false);

        if (error) {
            setResult({ type: 'error', message: error.message });
            return;
        }

        const res = data as { success: boolean; reason?: string; class_title?: string; start_time?: string };

        if (res.success) {
            setResult({
                type: 'success',
                classTitle: res.class_title || 'Aula',
                startTime: res.start_time ? res.start_time.substring(0, 5) : '',
            });
        } else {
            switch (res.reason) {
                case 'no_booking':
                    setResult({ type: 'no_booking' });
                    break;
                case 'invalid_code':
                    setResult({ type: 'invalid_code' });
                    break;
                default:
                    setResult({ type: 'error', message: res.reason || 'Erro desconhecido' });
            }
        }
    }, [loading, stopScanner]);

    const startScanner = useCallback(async () => {
        setCameraError(null);
        setResult(null);
        processedRef.current = false;

        // Aguardar um tick para garantir que o div está montado
        await new Promise(r => setTimeout(r, 100));

        const scanner = new Html5Qrcode('qr-reader', { verbose: false });
        scannerRef.current = scanner;

        try {
            await scanner.start(
                { facingMode: 'environment' }, // câmera traseira
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                handleQRSuccess,
                () => { /* erro de scan — ignorar silenciosamente */ }
            );
            setScanning(true);
        } catch (err: any) {
            scannerRef.current = null;
            const msg = err?.message || String(err);
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
                setCameraError('Acesso à câmera negado. Permite o acesso nas definições do teu browser.');
            } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('no camera')) {
                setCameraError('Câmera não encontrada neste dispositivo.');
            } else {
                setCameraError('Não foi possível iniciar a câmera. ' + msg);
            }
        }
    }, [handleQRSuccess]);

    // Parar scanner ao sair da página
    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, [stopScanner]);

    const handleTryAgain = () => {
        setResult(null);
        setCameraError(null);
        processedRef.current = false;
        startScanner();
    };

    // Formatar hora para display
    const formatTime = (t: string) => t.substring(0, 5);

    return (
        <div className="qr-scanner-page animate-fade-in">
            {/* Header com voltar */}
            <div className="qr-scanner-header">
                <button className="qr-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    <span>Voltar</span>
                </button>
                <h1 className="page-title" style={{ marginBottom: 0 }}>Fazer Check-in</h1>
            </div>

            <div className="qr-scanner-body">
                {/* Estado: resultado de check-in */}
                {result && !loading && (
                    <div className="qr-result-card animate-fade-in">
                        {result.type === 'success' && (
                            <>
                                <div className="qr-result-icon success">
                                    <CheckCircle size={64} />
                                </div>
                                <h2 className="qr-result-title success">Check-in efetuado com sucesso!</h2>
                                <p className="qr-result-detail">
                                    Presença registada na aula{' '}
                                    <strong style={{ color: 'var(--primary)' }}>{result.classTitle}</strong>
                                    {result.startTime && (
                                        <> das <strong>{formatTime(result.startTime)}</strong></>
                                    )}
                                </p>
                                <div className="qr-result-badge success-badge">
                                    ✅ A tua presença foi contabilizada
                                </div>
                                <button className="btn-qr-action" onClick={handleTryAgain}>
                                    <Camera size={18} /> Ler outro código
                                </button>
                            </>
                        )}

                        {result.type === 'no_booking' && (
                            <>
                                <div className="qr-result-icon warning">
                                    <AlertTriangle size={64} />
                                </div>
                                <h2 className="qr-result-title warning">Falha no Check-in</h2>
                                <p className="qr-result-detail">
                                    Não tens nenhuma marcação válida para este momento.
                                    Certifica-te de que estás inscrito numa aula que decorre agora
                                    (até 30 minutos antes do início e 1 hora após o fim).
                                </p>
                                <button className="btn-qr-action" onClick={handleTryAgain}>
                                    <Camera size={18} /> Tentar novamente
                                </button>
                            </>
                        )}

                        {result.type === 'invalid_code' && (
                            <>
                                <div className="qr-result-icon danger">
                                    <XCircle size={64} />
                                </div>
                                <h2 className="qr-result-title danger">Código inválido</h2>
                                <p className="qr-result-detail">
                                    O código QR lido não é válido para hoje.
                                    Certifica-te de que estás a ler o código correto na escola.
                                </p>
                                <button className="btn-qr-action" onClick={handleTryAgain}>
                                    <Camera size={18} /> Tentar novamente
                                </button>
                            </>
                        )}

                        {result.type === 'error' && (
                            <>
                                <div className="qr-result-icon danger">
                                    <XCircle size={64} />
                                </div>
                                <h2 className="qr-result-title danger">Ocorreu um erro</h2>
                                <p className="qr-result-detail">{result.message}</p>
                                <button className="btn-qr-action" onClick={handleTryAgain}>
                                    <Camera size={18} /> Tentar novamente
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Estado: loading após leitura */}
                {loading && (
                    <div className="qr-result-card animate-fade-in">
                        <div className="qr-loading-anim">
                            <div className="qr-spinner" />
                        </div>
                        <h2 className="qr-result-title" style={{ color: 'white' }}>A processar check-in...</h2>
                        <p className="qr-result-detail">Aguarda um momento.</p>
                    </div>
                )}

                {/* Estado: câmera com erro */}
                {!scanning && !loading && !result && cameraError && (
                    <div className="qr-result-card animate-fade-in">
                        <div className="qr-result-icon danger">
                            <Camera size={64} />
                        </div>
                        <h2 className="qr-result-title danger">Câmera indisponível</h2>
                        <p className="qr-result-detail">{cameraError}</p>
                        <button className="btn-qr-action" onClick={startScanner}>
                            <Camera size={18} /> Tentar novamente
                        </button>
                    </div>
                )}

                {/* Estado: pronto para iniciar */}
                {!scanning && !loading && !result && !cameraError && (
                    <div className="qr-start-card animate-fade-in">
                        <div className="qr-start-icon">
                            <Camera size={56} />
                        </div>
                        <h2 className="qr-start-title">Pronto para fazer check-in</h2>
                        <p className="qr-start-desc">
                            Aponta a câmera para o código QR exibido na escola para registar a tua presença.
                        </p>
                        <div className="qr-info-box">
                            <span>📋</span>
                            <span>
                                Precisas de ter uma <strong>marcação ativa</strong> numa aula que decorre agora
                                (ou que comece em menos de 30 minutos).
                            </span>
                        </div>
                        <button className="btn-qr-start" onClick={startScanner}>
                            <Camera size={20} /> Abrir câmera
                        </button>
                    </div>
                )}

                {/* Viewfinder da câmera */}
                {scanning && !loading && !result && (
                    <div className="qr-viewfinder-area animate-fade-in">
                        <p className="qr-viewfinder-label">Aponta para o código QR</p>
                        <div className="qr-viewfinder-wrapper">
                            <div id="qr-reader" className="qr-reader-element" />
                            {/* Cantos animados */}
                            <div className="qr-corner qr-corner-tl" />
                            <div className="qr-corner qr-corner-tr" />
                            <div className="qr-corner qr-corner-bl" />
                            <div className="qr-corner qr-corner-br" />
                            {/* Linha de scan */}
                            <div className="qr-scan-line" />
                        </div>
                        <button className="btn-qr-cancel" onClick={stopScanner}>
                            <XCircle size={16} /> Cancelar
                        </button>
                    </div>
                )}

                {/* Inicializar o div do scanner mesmo quando scanning (mas oculto até iniciar) */}
                {!scanning && (
                    <div id="qr-reader" style={{ display: 'none' }} />
                )}
            </div>

            {/* Saudação ao utilizador */}
            {!scanning && profile && (
                <div className="qr-user-info">
                    Olá, <strong>{profile.full_name}</strong> · {profile.belt}
                </div>
            )}

            <style>{`
        .qr-scanner-page {
          max-width: 520px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }
        .qr-scanner-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        .qr-back-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          color: var(--text-muted);
          padding: 0.45rem 0.85rem;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .qr-back-btn:hover { background: rgba(255,255,255,0.1); color: white; }

        .qr-scanner-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        /* ---- Start Card ---- */
        .qr-start-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          text-align: center;
          width: 100%;
          max-width: 420px;
        }
        .qr-start-icon {
          color: var(--primary);
          background: rgba(16,185,129,0.1);
          border-radius: 50%;
          padding: 1.25rem;
          display: flex;
        }
        .qr-start-title {
          color: white;
          font-size: 1.25rem;
          font-weight: 700;
        }
        .qr-start-desc {
          color: var(--text-muted);
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .qr-info-box {
          background: rgba(253,186,116,0.06);
          border: 1px solid rgba(253,186,116,0.2);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          text-align: left;
          font-size: 0.8rem;
          color: rgba(253,186,116,0.9);
          line-height: 1.5;
        }
        .btn-qr-start {
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 0.75rem;
          padding: 0.85rem 2rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(16,185,129,0.3);
          width: 100%;
          justify-content: center;
        }
        .btn-qr-start:hover {
          background: var(--primary-dark, #059669);
          transform: translateY(-1px);
          box-shadow: 0 6px 25px rgba(16,185,129,0.4);
        }

        /* ---- Viewfinder ---- */
        .qr-viewfinder-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 100%;
        }
        .qr-viewfinder-label {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .qr-viewfinder-wrapper {
          position: relative;
          width: 300px;
          height: 300px;
          border-radius: 1rem;
          overflow: hidden;
        }
        .qr-reader-element {
          width: 300px !important;
          height: 300px !important;
          border-radius: 1rem;
          overflow: hidden;
        }
        /* Esconder elementos internos do html5-qrcode que não precisamos */
        #qr-reader video {
          width: 300px !important;
          height: 300px !important;
          object-fit: cover;
          border-radius: 1rem;
        }
        #qr-reader img { display: none !important; }
        #qr-reader__header_message { display: none !important; }
        #qr-reader__status_span { display: none !important; }
        #qr-reader__camera_selection { display: none !important; }
        #qr-reader__filescan_input { display: none !important; }
        #qr-reader__dashboard { display: none !important; }

        /* Cantos do viewfinder */
        .qr-corner {
          position: absolute;
          width: 28px;
          height: 28px;
          border-color: var(--primary);
          border-style: solid;
          z-index: 10;
        }
        .qr-corner-tl { top: 8px; left: 8px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
        .qr-corner-tr { top: 8px; right: 8px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
        .qr-corner-bl { bottom: 8px; left: 8px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
        .qr-corner-br { bottom: 8px; right: 8px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }

        /* Linha de scan animada */
        .qr-scan-line {
          position: absolute;
          left: 12px;
          right: 12px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--primary), transparent);
          box-shadow: 0 0 8px rgba(16,185,129,0.8);
          animation: scan-sweep 2s ease-in-out infinite;
          z-index: 10;
        }
        @keyframes scan-sweep {
          0% { top: 12px; opacity: 1; }
          50% { top: calc(100% - 12px); opacity: 1; }
          51% { opacity: 0; }
          52% { top: 12px; opacity: 0; }
          53% { opacity: 1; }
          100% { top: 12px; opacity: 1; }
        }

        .btn-qr-cancel {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 0.5rem;
          color: var(--danger, #ef4444);
          padding: 0.5rem 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-qr-cancel:hover { background: rgba(239,68,68,0.2); }

        /* ---- Result Cards ---- */
        .qr-result-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
          width: 100%;
          max-width: 420px;
        }
        .qr-result-icon {
          border-radius: 50%;
          padding: 1rem;
          display: flex;
        }
        .qr-result-icon.success { color: var(--primary); background: rgba(16,185,129,0.1); }
        .qr-result-icon.warning { color: #f59e0b; background: rgba(245,158,11,0.1); }
        .qr-result-icon.danger { color: var(--danger, #ef4444); background: rgba(239,68,68,0.1); }

        .qr-result-title {
          font-size: 1.2rem;
          font-weight: 700;
        }
        .qr-result-title.success { color: var(--primary); }
        .qr-result-title.warning { color: #f59e0b; }
        .qr-result-title.danger { color: var(--danger, #ef4444); }

        .qr-result-detail {
          color: var(--text-muted);
          font-size: 0.875rem;
          line-height: 1.6;
          max-width: 320px;
        }

        .success-badge {
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 2rem;
          padding: 0.4rem 1.25rem;
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .btn-qr-action {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0.6rem;
          color: var(--text-muted);
          padding: 0.55rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
        }
        .btn-qr-action:hover { background: rgba(255,255,255,0.1); color: white; }

        /* ---- Loading spinner ---- */
        .qr-loading-anim { padding: 1rem; }
        .qr-spinner {
          width: 56px;
          height: 56px;
          border: 4px solid rgba(16,185,129,0.2);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ---- User Info ---- */
        .qr-user-info {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.8rem;
          margin-top: 1rem;
        }
        .qr-user-info strong { color: white; }

        @media (max-width: 480px) {
          .qr-start-card, .qr-result-card { padding: 2rem 1.25rem; }
          .qr-viewfinder-wrapper { width: 260px; height: 260px; }
          .qr-reader-element { width: 260px !important; height: 260px !important; }
          #qr-reader video { width: 260px !important; height: 260px !important; }
        }
      `}</style>
        </div>
    );
}
