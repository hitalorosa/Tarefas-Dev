'use client'

import {
  Award,
  Bell,
  Boxes,
  Briefcase,
  Bug,
  Calendar,
  ChartColumn,
  CircleCheck,
  Clapperboard,
  Compass,
  Flame,
  Folder,
  Globe,
  Heart,
  Image,
  KanbanSquare,
  Lightbulb,
  List,
  Megaphone,
  Monitor,
  Palette,
  Rocket,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from 'lucide-react'

/// Registro de ícones de projeto. A chave é o que vai pro banco, então trocar o
/// componente aqui não invalida nada que já foi salvo.
export const ICONES_PROJETO = {
  folder: Folder,
  list: List,
  kanban: KanbanSquare,
  calendar: Calendar,
  megaphone: Megaphone,
  palette: Palette,
  image: Image,
  clapperboard: Clapperboard,
  cart: ShoppingCart,
  chart: ChartColumn,
  target: Target,
  rocket: Rocket,
  flame: Flame,
  zap: Zap,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  star: Star,
  award: Award,
  heart: Heart,
  users: Users,
  briefcase: Briefcase,
  boxes: Boxes,
  globe: Globe,
  compass: Compass,
  monitor: Monitor,
  bell: Bell,
  bug: Bug,
  check: CircleCheck,
  settings: Settings,
} as const

export type ChaveIcone = keyof typeof ICONES_PROJETO

export function IconeProjeto({ nome, className }: { nome: string; className?: string }) {
  const Componente = ICONES_PROJETO[nome as ChaveIcone] ?? Folder
  return <Componente className={className} />
}

export const CHAVES_ICONE = Object.keys(ICONES_PROJETO) as ChaveIcone[]
