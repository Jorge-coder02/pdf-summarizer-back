import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => {
  res.json({ msg: "Servidor test OK" });
});

app.listen(PORT, () => {
  console.log(`Servidor test corriendo en puerto ${PORT}`);
});
