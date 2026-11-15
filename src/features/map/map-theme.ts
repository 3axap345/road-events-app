// Shared map and event details presentation. Reporting keeps its existing styles.
export const mapTheme = {
  colors: {
    primary: '#168FE8',
    primaryText: '#075B94',
    primarySurface: '#E8F4FD',
    mutedSurface: '#F3F6F8',
    dangerSurface: '#FFF1F0',
    surface: '#FFFFFF',
    text: '#172B3A',
    secondaryText: '#526777',
    border: '#E3EAF0',
    danger: '#A42D32',
    accident: '#DB5244',
    hazard: '#F5C542',
    closure: '#34495E'
  },
  space: { small: 4, medium: 8, large: 12, edge: 16 },
  radius: { panel: 20, button: 18, marker: 24 },
  size: { marker: 48, button: 56 },
  shadow: {
    shadowColor: '#18364A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5
  }
} as const;
