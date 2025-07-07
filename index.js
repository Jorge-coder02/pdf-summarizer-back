import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const app = express();
const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("🚨 process.env.PORT no está definido. Railway lo necesita.");
}

// Middleware
app.use(cors());

app.use(express.json());

// Multer config para guardar en 'uploads/'
// const uploadDir = path.resolve("uploads");
// fs.mkdir(uploadDir, { recursive: true });
const upload = multer({ dest: "uploads/" });

// async function testCohereKey() {
//   try {
//     const response = await axios.post(
//       "https://api.cohere.ai/v1/summarize",
//       {
//         text: "Este es un texto de prueba para verificar la clave API.",
//         length: "short",
//         format: "paragraph",
//       },
//       {
//         headers: {
//           Authorization: `Bearer TU_CLAVE_AQUI`,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     console.log("Respuesta Cohere:", response.data);
//   } catch (err) {
//     console.error("Error test Cohere:", err.response?.data || err.message);
//   }
// }
// testCohereKey();

// GET para prueba msg
app.get("/", (_, res) => {
  res.send("Todo en orden");
});

// POST /upload
// Recibe un archivo PDF, lo lee y lo resume usando CohereAI

const summaries = {}; // Memoria temporal

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const filePath = req.file.path;
    const id = Date.now().toString(); // ID único
    summaries[id] = { status: "processing" };

    res.json({ id }); // respuesta inmediata

    // Procesamiento en background
    const inputText = await extractTextFromPDF(filePath);
    await fs.unlink(filePath);

    const summary = await getSummaryFromCohere(inputText);
    summaries[id] = { status: "done", summary };
  } catch (err) {
    summaries[id] = { status: "error", error: err.message };
    console.error("❌ ERROR en /upload async:", err);
  }
});

// app.get("/result/:id", (req, res) => {
//   const result = summaries[req.params.id];
//   if (!result) {
//     return res.status(404).json({ error: "ID no encontrado" });
//   }
//   res.json(result);
// });

// Función para extraer texto de un PDF
async function extractTextFromPDF(filePath) {
  try {
    console.log("Leyendo PDF desde:", filePath);
    const fileBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const MAX_TOKENS = 8000;
    return pdfData.text.slice(0, MAX_TOKENS);
  } catch (error) {
    console.error("Error en extractTextFromPDF:", error.stack);
    throw error;
  }
}

// Función para llamar a la API de Cohere con el contenido del PDF
async function getSummaryFromCohere(text) {
  const inputText = `Idioma: Español\nFormato: párrafo\nResumen:\n\n${text}`;

  try {
    const response = await axios.post(
      "https://api.cohere.ai/v1/summarize",
      {
        text: inputText,
        length: "medium",
        format: "paragraph",
        model: "summarize-xlarge",
        extractiveness: "auto",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // const textoTranslated = await translateToSpanish(response.data.summary);
    // return textoTranslated;
    return response.data.summary;
  } catch (err) {
    console.error("❌ ERROR en getSummaryFromCohere:", err);
    throw err; // lanza para que el catch del endpoint lo gestione
  }
}

export async function translateToSpanish(text) {
  const res = await axios.post("https://de.libretranslate.com/translate", {
    q: text,
    source: "en",
    target: "es",
    format: "text",
  });

  return res.data.translatedText;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);

  //   console.log(
  //     "Clave OpenAI:",
  //     process.env.OPENAI_API_KEY ? "OK" : "NO encontrada"
  //   );
});
