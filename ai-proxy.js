import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import FormData from "form-data";

const app = express();
const upload = multer();

const API_KEY = process.env.LOGMEAL_KEY;

app.post("/analyze", upload.single("image"), async (req,res)=>{

  try{
    const form = new FormData();
    form.append("image", req.file.buffer, "food.jpg");

    const aiRes = await fetch(
      "https://api.logmeal.es/v2/image/recognition/complete",
      {
        method:"POST",
        headers:{
          "Authorization": "Bearer " + API_KEY
        },
        body: form
      }
    );

    const data = await aiRes.json();
    res.json(data);

  }catch(e){
    res.status(500).json({error:"AI failed"});
  }

});

app.listen(process.env.PORT || 3000);
