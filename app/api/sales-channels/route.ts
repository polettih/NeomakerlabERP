import {NextResponse} from "next/server";
import {requireUser} from "@/lib/auth";
export async function POST(request:Request){
  try{const body=await request.json(); const {supabase}=await requireUser(); const {data:m}=await supabase.from("organization_members").select("organization_id").limit(1).single(); if(!m) throw new Error("Organização não encontrada.");
  const {data,error}=await supabase.from("sales_channels").insert({organization_id:m.organization_id,name:String(body.name||"").trim(),active:body.active!==false}).select().single(); if(error) throw error; return NextResponse.json(data);}catch(e:any){return NextResponse.json({error:e.message||"Erro ao criar canal."},{status:500})}}
