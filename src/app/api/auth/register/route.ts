import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import zxcvbn from 'zxcvbn';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, captchaToken } = body;

    // 1. Validar reCAPTCHA
    if (captchaToken !== 'dev-token') {
        const secret = process.env.RECAPTCHA_SECRET_KEY;
        if (!secret) {
            console.error('RECAPTCHA_SECRET_KEY no configurada');
            return NextResponse.json({ error: 'Error de servidor: clave no configurada' }, { status: 500 });
        }

        const captchaResponse = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captchaToken}`, {
          method: 'POST',
        });
        const captchaData = await captchaResponse.json();

        if (!captchaData.success) {
          console.error('Error reCAPTCHA:', captchaData['error-codes']);
          return NextResponse.json({ error: 'Validación de seguridad fallida' }, { status: 403 });
        }
    }

    // 2. Validar fuerza de contraseña
    const passwordStrength = zxcvbn(password);
    if (passwordStrength.score < 3) {
      return NextResponse.json({ error: 'La contraseña es demasiado débil' }, { status: 400 });
    }

    // 3. Crear usuario con Supabase Admin (Service Role)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Supabase Admin Keys no configuradas');
        return NextResponse.json({ error: 'Error de servidor: configuración incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, key);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, 
      user_metadata: { full_name: `${firstName} ${lastName}` }
    });

    if (authError) {
        console.error('Error creando usuario en Supabase:', authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });

  } catch (error) {
      console.error('Error general en API registro:', error);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
