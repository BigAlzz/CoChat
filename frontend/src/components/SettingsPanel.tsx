import { Box, Title, Paper, Stack } from '@mantine/core'
import ModelManagement from './ModelManagement'

const SettingsPanel = () => {
  return (
    <Paper shadow="sm" p="md" style={{ height: '100%', background: '#25262B' }}>
      <Stack gap="md">
        <Box className="panel-header">
          <Title order={3}>Settings</Title>
        </Box>
        <ModelManagement />
      </Stack>
    </Paper>
  )
}

export default SettingsPanel 