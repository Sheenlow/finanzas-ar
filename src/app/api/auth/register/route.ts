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

    // 3. Crear usuario con el flujo estandar signUp (envia email de confirmacion)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        console.error('Supabase Keys no configuradas');
        return NextResponse.json({ error: 'Error de servidor: configuracion incompleta' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';
    const supabaseAnon = createClient(url, anonKey);

    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: `${firstName} ${lastName}` },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (authError) {
        console.error('Error creando usuario en Supabase:', authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
        return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: authData.user });

  } catch (error) {
      console.error('Error general en API registro:', error);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
