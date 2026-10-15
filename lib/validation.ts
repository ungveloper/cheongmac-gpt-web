import {z} from 'zod';
export const chatSchema=z.object({message:z.string().trim().min(1).max(2000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(2000)})).max(8).default([])}).strict();
export const changeSchema=z.object({operation:z.enum(['create','update','archive']),item_id:z.string().uuid().nullable(),expected_version:z.number().int().min(0).nullable(),title:z.string().trim().min(2).max(200),visibility:z.enum(['public','internal','restricted']),body:z.string().trim().max(12000)}).strict();
export const proposalResult=z.object({kind:z.enum(['question','proposal']),summary:z.string().max(1500),changes:z.array(changeSchema).max(12)}).strict();
