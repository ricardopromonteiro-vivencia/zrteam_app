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
                <p className="terms-date">Última atualização: 7 de março de 2026</p>

                <section>
                    <h2>1. Aceitação dos Termos</h2>
                    <p>Ao utilizares esta plataforma, concordas em cumprir estes termos e condições. Se não concordares, por favor não utilizes a app.</p>
                </section>

                <section>
                    <h2>2. Registo e Validação de Conta</h2>
                    <p>Após o registo, a tua conta fica <strong>pendente de validação</strong> pelo professor responsável ou administrador da tua escola. Enquanto a validação não for concluída, o acesso à plataforma estará limitado. Receberás notificação assim que a tua conta for aprovada.</p>
                    <p style={{ marginTop: '0.5rem' }}>O utilizador é responsável por manter a confidencialidade da sua palavra-passe e por todas as atividades que ocorram na sua conta. Compromete-se a fornecer dados reais e atualizados.</p>
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
                    <h2>5. Check-in e Presenças</h2>
                    <p>O registo de presença nas aulas é efetuado pelo professor ou administrador responsável, através do Painel de Check-in. O atleta não necessita de realizar qualquer ação para confirmar a sua presença — cabe ao professor validar e registar as presenças no final ou durante a aula.</p>
                </section>

                <section>
                    <h2>6. Proteção de Dados (RGPD)</h2>
                    <p>Os dados recolhidos por esta plataforma incluem: nome completo, data de nascimento, escola associada, faixa e grau de progressão, professor atribuído, histórico de presenças e registo de pagamentos. Estes dados são processados exclusivamente para fins de gestão administrativa da academia e nunca serão partilhados com terceiros para fins comerciais.</p>
                    <p style={{ marginTop: '0.5rem' }}>Tens o direito de aceder, corrigir ou solicitar a eliminação dos teus dados pessoais a qualquer momento, através das definições da tua conta ou contactando a administração da academia.</p>
                </section>

                <section>
                    <h2>7. Notificações Push</h2>
                    <p>A plataforma pode enviar notificações push para o teu dispositivo (mesmo com a app fechada), relativas a novos avisos da academia ou confirmações de validação de conta. Estas notificações são <strong>opcionais</strong> — podes ativá-las ou desativá-las a qualquer momento nas definições da app ou do teu dispositivo. Apenas o identificador técnico do teu dispositivo (endpoint) é guardado para este efeito, sem qualquer dado pessoal adicional associado.</p>
                </section>

                <section>
                    <h2>8. Arquivamento de Conta</h2>
                    <p>Em caso de ausência prolongada, o administrador ou professor responsável pode <strong>arquivar</strong> a tua conta. Os dados são conservados na íntegra durante o período de arquivo, permitindo a reativação sem perda de histórico. Serás notificado caso a tua conta seja arquivada ou reativada.</p>
                </section>

                <section>
                    <h2>9. Eliminação de Conta</h2>
                    <p>Podes solicitar a eliminação permanente da tua conta diretamente na tua Área Pessoal (Definições → Eliminar Conta). Esta ação é <strong>irreversível</strong> e implica a remoção de todos os teus dados da plataforma, incluindo histórico de presenças e pagamentos. A eliminação também pode ser solicitada pelo administrador mediante pedido justificado.</p>
                </section>

                <section>
                    <h2>10. Alterações aos Termos</h2>
                    <p>A academia reserva-se o direito de atualizar estes termos sempre que necessário. As alterações serão comunicadas através da plataforma. A utilização continuada após a publicação de alterações constitui aceitação dos novos termos.</p>
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
