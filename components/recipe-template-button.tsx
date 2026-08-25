"use client";
import React,{useState} from "react";
import {useRouter} from "next/navigation";
export function RecipeTemplateButton({template}:{template:any}){const r=useRouter();const [busy,setBusy]=useState(false);async function add(){setBusy(true);const res=await fetch("/api/painting-recipes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:template.name,category:template.category,description:template.description,colors:template.colors,dilution:template.dilution,finish:template.finish,notes:template.notes})});setBusy(false);if(res.ok)r.refresh();}return <button className="btn btn-secondary" onClick={add} disabled={busy}>{busy?"Adicionando...":"+ Minha biblioteca"}</button>}
