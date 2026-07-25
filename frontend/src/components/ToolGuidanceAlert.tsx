import CloseIcon from '@mui/icons-material/Close'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { TOOL_HINTS } from '../guidance/workflow'
import type { ToolMode } from '../domain/frame'

interface ToolGuidanceAlertProps {
  tool: ToolMode
  visible: boolean
  onDismiss: () => void
}

/** Contextual guidance banner that tracks the active modeling tool. */
export function ToolGuidanceAlert({ tool, visible, onDismiss }: ToolGuidanceAlertProps) {
  const hint = TOOL_HINTS[tool]

  return (
    <Collapse in={visible}>
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0 }}>
        <Alert
          severity="info"
          icon={<LightbulbOutlinedIcon fontSize="inherit" />}
          action={
            <IconButton
              aria-label="Dismiss guidance"
              color="inherit"
              size="small"
              onClick={onDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{
            alignItems: 'flex-start',
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <AlertTitle sx={{ mb: 0.5 }}>{hint.title}</AlertTitle>
          <Typography variant="body2" sx={{ mb: hint.tips.length ? 0.5 : 0 }}>
            {hint.body}
          </Typography>
          {hint.tips.length > 0 && (
            <List dense disablePadding sx={{ mt: 0.5 }}>
              {hint.tips.map((tip) => (
                <ListItem key={tip} disableGutters sx={{ py: 0, alignItems: 'flex-start' }}>
                  <ListItemText
                    primary={`• ${tip}`}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Alert>
      </Box>
    </Collapse>
  )
}
