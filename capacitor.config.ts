import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitflow.app',
  appName: 'FitFlow',
  // Vite gera o build de produção em ./dist
  webDir: 'dist',
  ios: {
    // Mantém o fundo escuro do tema enquanto o WebView carrega
    backgroundColor: '#0A0A0A',
    // Permite que o conteúdo desenhe sob a status bar (combina com viewport-fit=cover)
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0A0A0A',
      showSpinner: false,
      // splash some assim que o WebView estiver pronto
      launchAutoHide: true,
    },
    PushNotifications: {
      // mostra alerta + badge + som quando a push chega com o app aberto
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      // evita que o WebView seja redimensionado de forma brusca ao abrir o teclado
      resize: 'native' as never,
    },
  },
  // --- Live reload em device físico (DEV) ---------------------------------
  // Descomente e ajuste o IP da sua máquina para desenvolver com hot reload
  // direto no iPhone, sem precisar rebuildar a cada mudança:
  //
  // server: {
  //   url: 'http://192.168.0.100:8080',
  //   cleartext: true,
  // },
};

export default config;
