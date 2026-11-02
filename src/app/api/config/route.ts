import { NextResponse } from 'next/server';
import { jevLimitReached } from '../../../server/limit';
import { mailConfigured } from '../../../server/mail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){const limitReached=jevLimitReached();return NextResponse.json({liveAvailable:!limitReached&&!!(process.env.DATABASE_URL&&process.env.TYPESAFE_API_KEY),limitReached,mailAvailable:!limitReached&&mailConfigured()});}
