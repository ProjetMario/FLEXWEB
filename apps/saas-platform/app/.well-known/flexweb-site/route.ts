import { prisma } from '@/lib/prisma';
export async function GET(request:Request) {
 const host=request.headers.get('host')?.split(':')[0].toLowerCase();
 const site=host?await prisma.studioSite.findUnique({where:{domain:host}}):null;
 return new Response(site?.id||'Not found',{status:site?200:404,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
}
