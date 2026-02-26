import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
    const navigate = useNavigate();

    return (
        <div className="terms-page animate-fade-in">
            <button className="btn-back" onClick={() => navigate(-1)}>
                <ChevronLeft size={20} /> Voltar
            </button>

            <div className="terms-content">
                <h1 className="terms-title">Termos e Condições</h1>
                <p className="terms-date">Última atualização: 26 de fevereiro de 2026</p>

                <section>
                    <h2>1. Aceitação dos Termos</h2>
                    <p>Ao utilizares esta plataforma, concordas em cumprir estes termos e condições. Se não concordares, por favor não utilizes a app.</p>
                </section>

                <section>
                    <h2>2. Registo e Segurança</h2>
                    <p>O utilizador é responsável por manter a confidencialidade da sua palavra-passe e por todas as atividades que ocorram na sua conta. Compromete-se a fornecer dados reais e atualizados.</p>
                </section>

                <section>
                    <h2>3. Saúde e Condição Física</h2>
                    <p>Ao inscreveres-te em aulas de Jiu-Jitsu, declaras que possuis as condições físicas necessárias para a prática desportiva. A academia não se responsabiliza por lesões resultantes de negligência ou má prática.</p>
                </section>

                <section>
                    <h2>4. Cancelamento de Aulas</h2>
                    <p>O atleta deve desmarcar a sua presença com a antecedência mínima definida pela academia. A não comparência sem desmarcação ("No-Show") poderá resultar em penalizações automáticas no sistema.</p>
                </section>

                <section>
                    <h2>5. Proteção de Dados (RGPD)</h2>
                    <p>Os teus dados são processados apenas para gestão administrativa da academia (presenças, graduações e comunicações). Nunca partilharemos os teus dados com terceiros para fins comerciais.</p>
                </section>

                <section>
                    <h2>6. Check-in e Presenças</h2>
                    <p>O sistema de check-in utiliza a localização (GPS) para validar a presença física no local da aula. Ao clicares em "Confirmar Presença", autorizas o browser a capturar a tua localização momentânea para fins exclusivos de validação de aula.</p>
                </section>
            </div>

            <style>{`
                .terms-page { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
                .btn-back { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; color: var(--primary); cursor: pointer; font-weight: 600; margin-bottom: 2rem; }
                .terms-content { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; }
                .terms-title { font-size: 2rem; color: white; margin-bottom: 0.5rem; }
                .terms-date { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 2rem; }
                section { margin-bottom: 2rem; }
                section h2 { font-size: 1.25rem; color: var(--primary); margin-bottom: 0.75rem; }
                section p { color: var(--text-main); line-height: 1.6; }
            `}</style>
        </div>
    );
}
