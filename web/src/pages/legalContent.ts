export const CONTACT_EMAIL = "hey@jellylang.com";

export interface LegalSection {
    title: string;
    paragraphs?: string[];
    items?: string[];
}

export interface LegalDoc {
    title: string;
    updated: string;
    intro: string;
    sections: LegalSection[];
}

type Locale = "es" | "en";

export const PRIVACY: Record<Locale, LegalDoc> = {
    es: {
        title: "Política de privacidad",
        updated: "Última actualización: 24 de noviembre de 2026",
        intro: "Jellylang es una aplicación para aprender idiomas leyendo y escuchando contenido real. Esta política explica qué datos tratamos, para qué y qué control tienes sobre ellos.",
        sections: [
            {
                title: "Datos que recogemos",
                items: [
                    "Cuenta: correo electrónico, nombre (opcional), idioma de la interfaz, idioma nativo y una contraseña que guardamos cifrada (bcrypt); nunca la vemos ni la guardamos en claro.",
                    "Inicio de sesión con Google: si eliges esta opción, Google nos entrega tu correo (verificado), tu nombre, tu foto de perfil y un identificador de cuenta. No recibimos tu contraseña de Google ni accedemos a tu Gmail, contactos ni Drive.",
                    "Contenido de estudio: las lecciones que importas, las palabras que guardas (Jellies) con su traducción, notas y contexto, el estado de cada palabra, tus repasos y estadísticas de uso (palabras leídas, tiempo de escucha, racha diaria).",
                    "Datos técnicos: dirección IP y registros del servidor, que usamos para evitar abusos (límite de intentos de acceso) y para la seguridad del servicio.",
                ],
            },
            {
                title: "Para qué los usamos",
                items: [
                    "Crear y mantener tu cuenta, e iniciar tu sesión.",
                    "Enviarte correos del servicio: código de confirmación, recuperación de contraseña y bienvenida. No enviamos publicidad.",
                    "Mostrarte tu biblioteca, tu vocabulario, tus repasos y tus estadísticas.",
                    "Proteger el servicio frente a abusos y errores.",
                ],
            },
            {
                title: "Servicios de terceros",
                paragraphs: ["Para funcionar utilizamos estos proveedores, que reciben solo lo necesario:"],
                items: [
                    "Google: inicio de sesión con Google y reCAPTCHA (que analiza datos del navegador para distinguir personas de robots). Se rigen por la política de privacidad de Google.",
                    "Servicios de traducción (MyMemory o DeepL): reciben la palabra o frase que quieres traducir, sin datos de tu cuenta.",
                    "YouTube: los videos se reproducen con el reproductor oficial de YouTube, que se rige por sus propias condiciones y política de privacidad.",
                ],
            },
            {
                title: "Cookies y almacenamiento local",
                paragraphs: [
                    "Usamos el almacenamiento local de tu navegador para mantener tu sesión y recordar tu idioma, y una cookie de sesión para que la extensión del navegador pueda importar contenido a tu cuenta. No usamos cookies de publicidad ni de seguimiento propias. Google (reCAPTCHA e inicio de sesión) puede establecer las suyas.",
                ],
            },
            {
                title: "Conservación y venta de datos",
                paragraphs: [
                    "Conservamos tus datos mientras tengas la cuenta. No vendemos ni compartimos tus datos personales con terceros con fines comerciales.",
                ],
            },
            {
                title: "Tus derechos",
                paragraphs: [
                    `Puedes acceder a tus datos, corregirlos, exportar tu vocabulario (desde la página de vocabulario) y pedir que eliminemos tu cuenta y todos tus datos escribiendo a ${CONTACT_EMAIL}. Si usaste Google, también puedes retirar el acceso desde tu cuenta de Google en myaccount.google.com/permissions.`,
                ],
            },
            {
                title: "Menores",
                paragraphs: ["Jellylang no está dirigida a menores de 14 años. Si crees que un menor se ha registrado, avísanos y eliminaremos la cuenta."],
            },
            {
                title: "Cambios y contacto",
                paragraphs: [`Si cambiamos esta política, actualizaremos la fecha de esta página. Para cualquier duda, escríbenos a ${CONTACT_EMAIL}.`],
            },
        ],
    },
    en: {
        title: "Privacy Policy",
        updated: "Last updated: November 24, 2026",
        intro: "Jellylang is an app for learning languages by reading and listening to real content. This policy explains what data we process, why, and what control you have over it.",
        sections: [
            {
                title: "Data we collect",
                items: [
                    "Account: email address, name (optional), interface language, native language, and a password that we store hashed (bcrypt); we never see it or store it in plain text.",
                    "Sign in with Google: if you choose it, Google gives us your verified email, name, profile picture and an account identifier. We do not receive your Google password and we do not access your Gmail, contacts or Drive.",
                    "Study content: the lessons you import, the words you save (Jellies) with their translation, notes and context, each word's status, your reviews and usage statistics (words read, listening time, daily streak).",
                    "Technical data: IP address and server logs, which we use to prevent abuse (limiting login attempts) and to keep the service secure.",
                ],
            },
            {
                title: "How we use it",
                items: [
                    "To create and maintain your account and sign you in.",
                    "To send you service emails: confirmation code, password recovery and welcome. We do not send advertising.",
                    "To show your library, vocabulary, reviews and statistics.",
                    "To protect the service against abuse and errors.",
                ],
            },
            {
                title: "Third-party services",
                paragraphs: ["To operate we use these providers, which receive only what is necessary:"],
                items: [
                    "Google: Sign in with Google and reCAPTCHA (which analyzes browser data to tell people from robots). They are governed by Google's privacy policy.",
                    "Translation services (MyMemory or DeepL): receive the word or phrase you want translated, with no account data.",
                    "YouTube: videos play in the official YouTube player, which is governed by its own terms and privacy policy.",
                ],
            },
            {
                title: "Cookies and local storage",
                paragraphs: [
                    "We use your browser's local storage to keep you signed in and remember your language, and a session cookie so the browser extension can import content into your account. We do not use our own advertising or tracking cookies. Google (reCAPTCHA and sign-in) may set its own.",
                ],
            },
            {
                title: "Retention and sale of data",
                paragraphs: ["We keep your data while you have an account. We do not sell or share your personal data with third parties for commercial purposes."],
            },
            {
                title: "Your rights",
                paragraphs: [
                    `You can access and correct your data, export your vocabulary (from the vocabulary page), and ask us to delete your account and all your data by writing to ${CONTACT_EMAIL}. If you used Google, you can also revoke access from your Google account at myaccount.google.com/permissions.`,
                ],
            },
            {
                title: "Children",
                paragraphs: ["Jellylang is not directed to children under 14. If you believe a child has signed up, let us know and we will delete the account."],
            },
            {
                title: "Changes and contact",
                paragraphs: [`If we change this policy, we will update the date on this page. For any question, write to ${CONTACT_EMAIL}.`],
            },
        ],
    },
};

export const TERMS: Record<Locale, LegalDoc> = {
    es: {
        title: "Condiciones del servicio",
        updated: "Última actualización: 24 de noviembre de 2026",
        intro: "Al crear una cuenta o usar Jellylang aceptas estas condiciones. Si no estás de acuerdo, no uses el servicio.",
        sections: [
            {
                title: "El servicio",
                paragraphs: [
                    "Jellylang te permite importar textos y subtítulos, leerlos y escucharlos, guardar palabras con su traducción y repasarlas con repetición espaciada. Puede cambiar, mejorar o dejar de ofrecer funciones con el tiempo.",
                ],
            },
            {
                title: "Tu cuenta",
                items: [
                    "Debes dar un correo real que controles y mantener tu contraseña en secreto.",
                    "Eres responsable de lo que ocurra con tu cuenta. Avísanos si sospechas un uso no autorizado.",
                    "Puedes iniciar sesión con correo y contraseña o con Google. Si ya tienes una cuenta con el mismo correo, entrarás en esa misma cuenta.",
                ],
            },
            {
                title: "Uso aceptable",
                items: [
                    "No uses el servicio para actividades ilegales ni para vulnerar derechos de terceros.",
                    "No intentes acceder a cuentas ajenas, saturar el servicio ni eludir sus límites de seguridad.",
                    "No automatices el acceso de forma abusiva (por ejemplo, scraping masivo).",
                ],
            },
            {
                title: "Contenido que importas",
                paragraphs: [
                    "Eres responsable de tener derecho a usar los textos, subtítulos y videos que importas. Tu contenido sigue siendo tuyo; solo lo usamos para ofrecerte el servicio. Los videos de YouTube se reproducen con su reproductor oficial y están sujetos a las condiciones de YouTube.",
                ],
            },
            {
                title: "Disponibilidad y garantías",
                paragraphs: [
                    "El servicio se ofrece «tal cual», sin garantía de disponibilidad continua ni de que esté libre de errores. Las traducciones son automáticas y pueden contener errores. En la medida permitida por la ley, no respondemos de daños indirectos derivados del uso del servicio.",
                ],
            },
            {
                title: "Suspensión y baja",
                paragraphs: [
                    `Puedes dejar de usar Jellylang cuando quieras y pedir la eliminación de tu cuenta en ${CONTACT_EMAIL}. Podemos suspender cuentas que incumplan estas condiciones.`,
                ],
            },
            {
                title: "Privacidad",
                paragraphs: ["El tratamiento de tus datos se describe en nuestra Política de privacidad."],
            },
            {
                title: "Cambios y contacto",
                paragraphs: [`Podemos actualizar estas condiciones; la fecha de esta página indica la última versión. Si sigues usando el servicio, aceptas los cambios. Contacto: ${CONTACT_EMAIL}.`],
            },
        ],
    },
    en: {
        title: "Terms of Service",
        updated: "Last updated: November 24, 2026",
        intro: "By creating an account or using Jellylang you agree to these terms. If you do not agree, do not use the service.",
        sections: [
            {
                title: "The service",
                paragraphs: [
                    "Jellylang lets you import texts and subtitles, read and listen to them, save words with their translation and review them with spaced repetition. Features may change, improve or be discontinued over time.",
                ],
            },
            {
                title: "Your account",
                items: [
                    "You must provide a real email you control and keep your password secret.",
                    "You are responsible for what happens with your account. Tell us if you suspect unauthorized use.",
                    "You can sign in with email and password or with Google. If you already have an account with the same email, you will sign in to that same account.",
                ],
            },
            {
                title: "Acceptable use",
                items: [
                    "Do not use the service for illegal activities or to infringe third-party rights.",
                    "Do not try to access other people's accounts, overload the service or bypass its security limits.",
                    "Do not automate access abusively (for example, mass scraping).",
                ],
            },
            {
                title: "Content you import",
                paragraphs: [
                    "You are responsible for having the right to use the texts, subtitles and videos you import. Your content remains yours; we only use it to provide the service. YouTube videos play in the official YouTube player and are subject to YouTube's terms.",
                ],
            },
            {
                title: "Availability and warranties",
                paragraphs: [
                    "The service is provided \"as is\", with no guarantee of continuous availability or of being error-free. Translations are automatic and may contain errors. To the extent permitted by law, we are not liable for indirect damages arising from use of the service.",
                ],
            },
            {
                title: "Suspension and termination",
                paragraphs: [
                    `You can stop using Jellylang at any time and request deletion of your account at ${CONTACT_EMAIL}. We may suspend accounts that violate these terms.`,
                ],
            },
            {
                title: "Privacy",
                paragraphs: ["How we process your data is described in our Privacy Policy."],
            },
            {
                title: "Changes and contact",
                paragraphs: [`We may update these terms; the date on this page shows the latest version. If you keep using the service, you accept the changes. Contact: ${CONTACT_EMAIL}.`],
            },
        ],
    },
};
