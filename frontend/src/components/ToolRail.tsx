import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CategoryIcon from '@mui/icons-material/Category'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import HistoryIcon from '@mui/icons-material/History'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import NearMeIcon from '@mui/icons-material/NearMe'
import SouthIcon from '@mui/icons-material/South'
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { SvgIconComponent } from '@mui/icons-material'
import type { ToolMode } from '../domain/frame'
import { TOOL_HINTS } from '../guidance/workflow'

interface ToolRailProps {
  activeTool: ToolMode
  onToolChange: (tool: ToolMode) => void
}

interface ToolDefinition {
  id: ToolMode
  label: string
  shortcut: string
  icon: SvgIconComponent
}

const tools: ToolDefinition[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: NearMeIcon },
  { id: 'node', label: 'Node', shortcut: 'N', icon: FiberManualRecordIcon },
  { id: 'material', label: 'Material', shortcut: 'M', icon: LibraryBooksIcon },
  { id: 'section', label: 'Section', shortcut: 'C', icon: CategoryIcon },
  { id: 'element', label: 'Element', shortcut: 'E', icon: AccountTreeIcon },
  { id: 'support', label: 'Support', shortcut: 'S', icon: ChangeHistoryIcon },
  { id: 'load', label: 'Load', shortcut: 'L', icon: SouthIcon },
]

const modelTool: ToolDefinition = {
  id: 'models',
  label: 'Models',
  shortcut: 'H',
  icon: HistoryIcon,
}

function ToolButton({
  tool,
  active,
  onClick,
}: {
  tool: ToolDefinition
  active: boolean
  onClick: () => void
}) {
  const Icon = tool.icon
  const hint = TOOL_HINTS[tool.id]
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2">{tool.label} ({tool.shortcut})</Typography>
          <Typography variant="caption" display="block">
            {hint.body}
          </Typography>
        </Box>
      }
      placement="right"
      describeChild
    >
      <ListItemButton
        selected={active}
        onClick={onClick}
        aria-pressed={active}
        sx={{
          flex: '0 0 auto',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 1.25,
          px: 0.5,
          borderRadius: 2,
          minHeight: 64,
          maxHeight: 72,
          height: 64,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '& .MuiListItemIcon-root': { color: 'inherit' },
            '&:hover': { bgcolor: 'primary.dark' },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'inherit', flex: '0 0 auto' }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={tool.label}
          sx={{ flex: '0 0 auto', margin: 0, mt: 0.5 }}
          primaryTypographyProps={{
            variant: 'caption',
            fontWeight: 600,
            textAlign: 'center',
            noWrap: true,
            sx: { lineHeight: 1.2 },
          }}
        />
      </ListItemButton>
    </Tooltip>
  )
}

export function ToolRail({ activeTool, onToolChange }: ToolRailProps) {
  return (
    <Box
      component="nav"
      aria-label="Modeling tools"
      sx={{
        width: { xs: 64, sm: 88 },
        height: '100%',
        flex: '1 1 auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        py: 1.5,
        px: 0.75,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: 'none', sm: 'block' },
          textAlign: 'center',
          fontWeight: 700,
          letterSpacing: 0.12,
          mb: 1,
          flex: '0 0 auto',
        }}
      >
        MODEL
      </Typography>
      <List
        disablePadding
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => onToolChange(tool.id)}
          />
        ))}
      </List>
      <Box sx={{ flex: '0 0 auto', pt: 1, mt: 'auto' }}>
        <Divider sx={{ mb: 1 }} />
        <ToolButton
          tool={modelTool}
          active={activeTool === 'models'}
          onClick={() => onToolChange('models')}
        />
      </Box>
    </Box>
  )
}
