import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {data,error} = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return {supabase,userId};
}