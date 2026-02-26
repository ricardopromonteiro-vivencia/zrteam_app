-- ==========================================
-- FUNÇÕES RPC PARA INCREMENTAR/DECREMENTAR PRESENÇAS
-- Corre no SQL Editor do Supabase
-- ==========================================

-- Função para incrementar presenças (chamada no check-in)
CREATE OR REPLACE FUNCTION increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET attended_classes = attended_classes + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para decrementar presenças (penalização de no-show)
-- Nunca vai abaixo de 0
CREATE OR REPLACE FUNCTION decrement_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET attended_classes = GREATEST(attended_classes - 1, 0)
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- EDGE FUNCTION PARA RECEBER PINGS DO ESP32 (NFC)
-- Cria este ficheiro em: supabase/functions/nfc-checkin/index.ts
-- E faz deploy com: supabase functions deploy nfc-checkin
-- ==========================================
-- Código da Edge Function (TypeScript):

/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  // Aceitar apenas POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const { nfc_uid, class_id } = await req.json()

  if (!nfc_uid || !class_id) {
    return new Response(JSON.stringify({ error: 'nfc_uid e class_id são obrigatórios' }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 1. Encontrar o atleta pelo NFC UID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('nfc_uid', nfc_uid)
    .single()

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Cartão NFC não registado em nenhum atleta.' }), { status: 404 })
  }

  // 2. Verificar se o atleta está inscrito na aula
  const { data: booking, error: bookingError } = await supabase
    .from('class_bookings')
    .select('id, status')
    .eq('class_id', class_id)
    .eq('user_id', profile.id)
    .single()

  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: 'Atleta não inscrito nesta aula.' }), { status: 404 })
  }

  if (booking.status === 'Presente') {
    return new Response(JSON.stringify({ message: `${profile.full_name} já tem presença registada.` }), { status: 200 })
  }

  // 3. Registar presença
  await supabase
    .from('class_bookings')
    .update({ status: 'Presente' })
    .eq('id', booking.id)

  // 4. Incrementar o contador de aulas
  await supabase.rpc('increment_attended_classes', { user_id_param: profile.id })

  return new Response(
    JSON.stringify({ success: true, message: `✅ Check-in de ${profile.full_name} registado com sucesso!` }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
*/

-- ==========================================
-- EXEMPLO DE CÓDIGO ARDUINO/ESP32
-- O ESP32 envia POST para a URL da Edge Function
-- ==========================================

/*
  Exemplo de código para o ESP32:

  void doCheckIn(String nfcUid) {
    HTTPClient http;
    http.begin("https://<PROJECT_REF>.supabase.co/functions/v1/nfc-checkin");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer <ANON_KEY>");

    String payload = "{\"nfc_uid\":\"" + nfcUid + "\",\"class_id\":\"<CLASS_ID>\"}";
    int httpResponseCode = http.POST(payload);

    Serial.println(http.getString());
    http.end();
  }
*/
