
function mostrarSeccion(id) {
    document.querySelectorAll("main section").forEach(seccion => {
        seccion.classList.add("oculto");
    });

    document.getElementById(id).classList.remove("oculto");
}

// Limpia las referencias internas de Microsoft Foundry.
function limpiarReferencias(texto) {
    return String(texto)
        .replace(/filecite[^]*/g, " [Documento consultado]")
        .replace(/[^]*/g, "")
        .replace(/\uFFFD/g, "");
}

// Evita que el texto recibido se interprete como HTML peligroso.
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => {
        const equivalencias = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };
        return equivalencias[caracter];
    });
}

// Da formato básico a negritas y texto en línea.
function formatoEnLinea(texto) {
    return escaparHTML(texto)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// Convierte una tabla Markdown en una tabla HTML.
function crearTabla(lineas) {
    const filas = lineas.map(linea =>
        linea.trim().replace(/^\||\|$/g, "")
            .split("|").map(celda => celda.trim())
    );

    const encabezados = filas[0];
    const contenido = filas.slice(2);

    let html = "<div class='tabla-scroll'><table><thead><tr>";

    encabezados.forEach(celda => {
        html += "<th>" + formatoEnLinea(celda) + "</th>";
    });

    html += "</tr></thead><tbody>";

    contenido.forEach(fila => {
        html += "<tr>";

        encabezados.forEach((_, indice) => {
            html += "<td>" +
                formatoEnLinea(fila[indice] || "") +
                "</td>";
        });

        html += "</tr>";
    });

    return html + "</tbody></table></div>";
}

// Convierte respuestas Markdown a HTML seguro.
function formatearRespuesta(texto) {
    const limpio = limpiarReferencias(texto);
    const lineas = limpio.split(/\r?\n/);
    const partes = [];

    let indice = 0;
    let listaActual = null;

    function cerrarLista() {
        if (listaActual) {
            partes.push("</" + listaActual + ">");
            listaActual = null;
        }
    }

    function esFilaTabla(linea) {
        return /^\s*\|?.+\|.+\|?\s*$/.test(linea);
    }

    function esSeparadorTabla(linea) {
        return /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(linea)
            && linea.includes("-");
    }

    while (indice < lineas.length) {
        const linea = lineas[indice].trim();

        if (!linea) {
            cerrarLista();
            indice++;
            continue;
        }

        // Tablas Markdown.
        if (
            indice + 1 < lineas.length &&
            esFilaTabla(linea) &&
            esSeparadorTabla(lineas[indice + 1])
        ) {
            cerrarLista();

            const tabla = [lineas[indice], lineas[indice + 1]];
            indice += 2;

            while (
                indice < lineas.length &&
                esFilaTabla(lineas[indice])
            ) {
                tabla.push(lineas[indice]);
                indice++;
            }

            partes.push(crearTabla(tabla));
            continue;
        }

        // Encabezados.
        const encabezado = linea.match(/^(#{1,3})\s+(.+)$/);

        if (encabezado) {
            cerrarLista();

            const nivel = encabezado[1].length + 2;
            partes.push(
                "<h" + nivel + ">" +
                formatoEnLinea(encabezado[2]) +
                "</h" + nivel + ">"
            );

            indice++;
            continue;
        }

        // Listas numeradas o con viñetas.
        const numerada = linea.match(/^\d+[.)]\s+(.+)$/);
        const vineta = linea.match(/^[-*•]\s+(.+)$/);

        if (numerada || vineta) {
            const tipo = numerada ? "ol" : "ul";

            if (listaActual !== tipo) {
                cerrarLista();
                partes.push("<" + tipo + ">");
                listaActual = tipo;
            }

            partes.push(
                "<li>" +
                formatoEnLinea((numerada || vineta)[1]) +
                "</li>"
            );

            indice++;
            continue;
        }

        // Párrafos normales.
        cerrarLista();
        partes.push("<p>" + formatoEnLinea(linea) + "</p>");
        indice++;
    }

    cerrarLista();

    return partes.join("");
}

function agregarMensaje(texto, tipo) {
    const contenedor = document.getElementById("mensajes");
    const mensaje = document.createElement("div");

    mensaje.className = "mensaje " + tipo;

    if (tipo === "bot") {
        mensaje.classList.add("formateado");
        mensaje.innerHTML = formatearRespuesta(texto);
    } else {
        mensaje.textContent = texto;
    }

    contenedor.appendChild(mensaje);
    contenedor.scrollTop = contenedor.scrollHeight;

    return mensaje;
}

function actualizarMensaje(mensaje, texto) {
    mensaje.classList.add("formateado");
    mensaje.innerHTML = formatearRespuesta(texto);

    const contenedor = document.getElementById("mensajes");
    contenedor.scrollTop = contenedor.scrollHeight;
}

function obtenerHistorialParaAzure(pregunta) {
    const historial = [];

    if (conversacionActual) {
        const conversacion = conversaciones.find(
            item => item.id === conversacionActual
        );

        if (conversacion && Array.isArray(conversacion.mensajes)) {
            conversacion.mensajes.forEach(mensaje => {
                historial.push({
                    role: mensaje.tipo === "usuario" ? "user" : "assistant",
                    content: mensaje.texto
                });
            });
        }
    }

    historial.push({
        role: "user",
        content: pregunta
    });

    return historial;
}

async function enviarPregunta(pregunta) {
    agregarMensaje(pregunta, "usuario");

    const esperando = agregarMensaje(
        "Consultando al asistente de Río Claro...",
        "bot"
    );

    try {
        const respuesta = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mensaje: pregunta,
                historial: obtenerHistorialParaAzure(pregunta)
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.error || "Error del servidor");
        }

        actualizarMensaje(
            esperando,
            datos.respuesta || "No se recibió respuesta."
        );
        hablarRespuesta(datos.respuesta || "");
        registrarIntercambio(
            pregunta,
            datos.respuesta || "No se recibió respuesta."
        );

    } catch (error) {
        actualizarMensaje(
            esperando,
            "No se pudo consultar el asistente: " + error.message
        );
    }
}

document.getElementById("formChat").addEventListener(
    "submit",
    async (evento) => {
        evento.preventDefault();

        const campo = document.getElementById("pregunta");
        const pregunta = campo.value.trim();

        if (!pregunta) return;

        campo.value = "";
        await enviarPregunta(pregunta);
    }
);

function consultarFactura() {
    mostrarSeccion("asistente");

    enviarPregunta(
        "Consulta la factura ficticia RC-1001 en los documentos de Río Claro. " +
        "Indica cliente, productos, subtotal, IVA y total. " +
        "No inventes información."
    );
}
// ===== FUNCIONES DE VOZ =====

let vozActivada = false;

function activarVoz() {
    vozActivada = !vozActivada;

    const boton = document.getElementById("botonVoz");

    if (boton) {
        boton.textContent = vozActivada
            ? "🔊 Voz activada"
            : "🔇 Voz desactivada";
    }

    if (!vozActivada && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
}

function hablarRespuesta(texto) {
    if (!vozActivada || !("speechSynthesis" in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const mensaje = new SpeechSynthesisUtterance(texto);

    mensaje.lang = "es-MX";
    mensaje.rate = 0.95;
    mensaje.pitch = 1;
    mensaje.volume = 1;

    window.speechSynthesis.speak(mensaje);
}

function escucharPregunta() {
    const Reconocimiento =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Reconocimiento) {
        alert("Tu navegador no admite reconocimiento de voz.");
        return;
    }

    const reconocimiento = new Reconocimiento();

    reconocimiento.lang = "es-MX";
    reconocimiento.interimResults = false;
    reconocimiento.continuous = false;

    reconocimiento.onresult = function(evento) {
        const pregunta = evento.results[0][0].transcript;

        document.getElementById("pregunta").value = pregunta;
    };

    reconocimiento.onerror = function(evento) {
        console.error("Error de reconocimiento:", evento.error);
    };

    reconocimiento.start();
}
// ===== HISTORIAL DE CONVERSACIONES =====

const CLAVE_HISTORIAL = "rioClaroHistorialV2";

let conversaciones = [];
let conversacionActual = null;

function guardarHistorial() {
    try {
        localStorage.setItem(
            CLAVE_HISTORIAL,
            JSON.stringify(conversaciones)
        );
    } catch (error) {
        console.warn("No se pudo guardar el historial:", error);
    }
}

function cargarHistorial() {
    try {
        conversaciones = JSON.parse(
            localStorage.getItem(CLAVE_HISTORIAL) || "[]"
        );

        if (!Array.isArray(conversaciones)) {
            conversaciones = [];
        }
    } catch (error) {
        conversaciones = [];
    }

    actualizarListaHistorial();
}

function nuevaConversacion() {
    conversacionActual = null;

    const contenedor = document.getElementById("mensajes");
    contenedor.innerHTML = "";

    agregarMensaje(
        "¡Hola! Soy Río Claro IA. ¿En qué puedo ayudarte?",
        "bot"
    );

    mostrarSeccion("asistente");
    actualizarListaHistorial();
}

function registrarIntercambio(pregunta, respuesta) {
    if (!conversacionActual) {
        conversacionActual = String(Date.now());

        conversaciones.unshift({
            id: conversacionActual,
            titulo: pregunta.substring(0, 45),
            mensajes: []
        });
    }

    const conversacion = conversaciones.find(
        c => c.id === conversacionActual
    );

    if (!conversacion) return;

    conversacion.mensajes.push(
        { texto: pregunta, tipo: "usuario" },
        { texto: respuesta, tipo: "bot" }
    );

    guardarHistorial();
    actualizarListaHistorial();
}

function abrirConversacion(id) {
    const conversacion = conversaciones.find(c => c.id === id);

    if (!conversacion) return;

    conversacionActual = id;

    const contenedor = document.getElementById("mensajes");
    contenedor.innerHTML = "";

    conversacion.mensajes.forEach(mensaje => {
        agregarMensaje(mensaje.texto, mensaje.tipo);
    });

    mostrarSeccion("asistente");
    actualizarListaHistorial();
}

function actualizarListaHistorial() {
    const lista = document.getElementById("listaHistorial");

    if (!lista) return;

    lista.innerHTML = "";

    conversaciones.forEach(conversacion => {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.textContent = conversacion.titulo;
        boton.title = conversacion.titulo;

        if (conversacion.id === conversacionActual) {
            boton.classList.add("activo");
        }

        boton.addEventListener("click", () => {
            abrirConversacion(conversacion.id);
        });

        lista.appendChild(boton);
    });
}

cargarHistorial();