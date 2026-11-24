import { useState } from "react";
import styles from "./Avatar.module.scss";

interface Props {
    url: string | null;
    /** Nombre o email, para la inicial cuando la foto no carga */
    label: string;
    size?: number;
}

/** Foto de perfil (Google); si no hay o falla al cargar, muestra la inicial. */
export default function Avatar({ url, label, size = 32 }: Props) {
    const [failed, setFailed] = useState(false);
    const style = { width: size, height: size, fontSize: size * 0.45 };

    if (url && !failed) {
        return <img className={styles.avatar} style={style} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
    }
    return (
        <span className={`${styles.avatar} ${styles.initial}`} style={style} aria-hidden="true">
            {label.trim().charAt(0).toUpperCase() || "?"}
        </span>
    );
}
