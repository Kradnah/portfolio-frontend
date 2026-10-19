import { ApplicationConfig, Injectable } from '@angular/core';
import { DefaultUrlSerializer, UrlSerializer, UrlTree, provideRouter } from '@angular/router';

import { routes } from './app.routes';

/** Deja las "/" sin codificar en la query (?f=apps/api/main.ts): enlaces del visor de código legibles. */
@Injectable()
class ReadableUrlSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    const url = super.serialize(tree);
    const q = url.indexOf('?');
    return q < 0 ? url : url.slice(0, q) + url.slice(q).replace(/%2F/gi, '/');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: UrlSerializer, useClass: ReadableUrlSerializer },
  ]
};
