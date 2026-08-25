import {NextResponse} from "next/server"; import {requireUser} from "@/lib/auth";
export async function POST(request:Request){
  try{const body=await request.json();if(!body.description||!body.amount)return NextResponse.json({error:"Descrição e valor são obrigatórios."},{status:400});
    const {supabase}=await requireUser();const {data:member}=await supabase.from("organization_members").select("organization_id").limit(1).single();if(!member)throw new Error("Organização não encontrada.");
    const {data,error}=await supabase.from("expenses").insert({organization_id:member.organization_id,description:body.description,category:body.category||null,amount:Number(body.amount)}).select().single();if(error)throw error;return NextResponse.json(data);
  }catch(e:any){return NextResponse.json({error:e.message||"Erro interno"},{status:500})}
}