import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private secretKey = environment.encryptionKey;

  constructor() { }

  /**
   * Encripta un texto usando AES
   */
  encrypt(text: string): string {
    if (!text) return text;
    try {
      return CryptoJS.AES.encrypt(text, this.secretKey).toString();
    } catch (e) {
      console.error('Error encrypting data', e);
      return text;
    }
  }

  /**
   * Desencripta un texto previamente encriptado con AES
   */
  decrypt(cipherText: string): string {
    if (!cipherText) return cipherText;
    try {
      // Prevenir intentos de desencriptar si no parece encriptado por AES de CryptoJS (que suele iniciar con U2FsdGVkX1 o similar)
      const bytes = CryptoJS.AES.decrypt(cipherText, this.secretKey);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      // Si el toString no retorna nada o da error UTF8 suave, fallamos graceful
      if (!originalText) return cipherText;
      return originalText;
    } catch (e) {
      // Probablemente no era Data encriptada con esta key o formato inválido
      return cipherText;
    }
  }

  /**
   * Encripta una porción de las notificaciones u otra data sensible en JSON
   * Modifica el arreglo inplace en algunos campos.
   */
  encryptNotifications(notificaciones: any[]): any[] {
    if (!notificaciones || !Array.isArray(notificaciones)) return notificaciones;
    return notificaciones.map(noti => {
      const cloned = { ...noti };
      if (cloned.correo) cloned.correo = this.encrypt(cloned.correo);
      if (cloned.telefono) cloned.telefono = this.encrypt(cloned.telefono);
      return cloned;
    });
  }

  /**
   * Desencripta una porción de las notificaciones u otra data sensible
   */
  decryptNotifications(notificaciones: any[]): any[] {
    if (!notificaciones || !Array.isArray(notificaciones)) return notificaciones;
    return notificaciones.map(noti => {
      const cloned = { ...noti };
      if (cloned.correo) cloned.correo = this.decrypt(cloned.correo);
      if (cloned.telefono) cloned.telefono = this.decrypt(cloned.telefono);
      return cloned;
    });
  }
}
