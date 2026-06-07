// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Edit,
  Trash2,
  MoreVertical,
  Bot,
  Sparkles,
  Sun,
  Moon,
  File,
  FileText,
  UploadCloud,
  MessageSquare,
  Send,
  Database,
  Search,
  Layers,
  Scissors,
  Cpu,
  SlidersHorizontal,
  List,
  Box,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Menu,
  HelpCircle,
  Zap,
  Clock,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  plus: Plus,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-back': ArrowLeft,
  'arrow-up': ArrowUp,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  check: Check,
  x: X,
  edit: Edit,
  trash: Trash2,
  more: MoreVertical,
  bot: Bot,
  sparkles: Sparkles,
  sun: Sun,
  moon: Moon,
  file: File,
  'file-text': FileText,
  'upload-cloud': UploadCloud,
  message: MessageSquare,
  send: Send,
  database: Database,
  search: Search,
  layers: Layers,
  scissors: Scissors,
  cpu: Cpu,
  sliders: SlidersHorizontal,
  list: List,
  box: Box,
  'check-circle': CheckCircle2,
  alert: AlertCircle,
  loader: Loader2,
  menu: Menu,
  help: HelpCircle,
  zap: Zap,
  clock: Clock,
}

interface IconProps {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

export function Icon({ name, size = 16, className, strokeWidth = 2, style }: IconProps) {
  const Component = ICON_MAP[name]
  if (!Component) return null
  return <Component size={size} className={className} strokeWidth={strokeWidth} style={style} />
}
