import {
  Injectable,
  ViewContainerRef,
  ComponentFactoryResolver,
  ApplicationRef,
  Injector,
  ComponentFactory,
  ComponentRef
} from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subscription } from 'rxjs/Subscription';
import { getSymbolObservable } from 'rxjs/symbol/observable';
import { SpawnReference } from './interfaces/SpawnReference';

@Injectable()
export class AFSpawnService {

  constructor(
    private cfr: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector
  ) { }

  createComponent(componentType: any, viewContainerRef?: ViewContainerRef, context?: any): SpawnReference {

    const factory: ComponentFactory<any> = this.cfr.resolveComponentFactory(componentType);

    let componentRef: ComponentRef<any>;
    if (viewContainerRef) {
      componentRef = viewContainerRef.createComponent(factory);
    } else {
      componentRef = factory.create(this.injector);
      this.appRef.attachView(componentRef.hostView);
      document.body.appendChild((componentRef.hostView as any).rootNodes[0]);
    }

    const subscriptions: Subscription[] = this.wireOutputs(factory, componentRef, context);
    const observableSymbol: any = getSymbolObservable(window);
    let context$: BehaviorSubject<any>;
    if (context && context[observableSymbol]) {
      context$ = context;
    } else {
      context$ = new BehaviorSubject(context);
    }

    subscriptions.push(context$.subscribe(() => {
      factory.inputs.forEach(input => {
        if (context[input.propName] !== undefined) {
          componentRef.instance[input.propName] = context[input.propName];
        }
      });
    }));

    const detach = () => {
      if (!viewContainerRef) {
        this.appRef.detachView(componentRef.hostView);
      }
      componentRef.destroy();
      subscriptions.map(subscription => { if (!subscription.closed) { subscription.unsubscribe(); } });
    };

    const next = (data: any) => {
      if (context$ === context) {
        throw new Error(`When passing an observable as a context, you cannot call the \`.next\` function from the result.
        If you wish to update the values in your context, send the data through the observable that you passed in as the context.`);
      }

      context$.next(data);
    };

    return {
      detach,
      next
    };
  }

  private wireOutputs(factory: ComponentFactory<any>, componentRef: ComponentRef<any>, context: { [key: string]: any }): Array<Subscription> {
    const subscriptions: Subscription[] = [];
    factory.outputs.forEach(output => {
      if (context[output.propName] && context[output.propName] instanceof Function) {
        subscriptions.push(componentRef.instance[output.propName].subscribe(context[output.propName]));
      }
    });
    return subscriptions;
  }
}
