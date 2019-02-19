export enum OperatingResultType {
  Null,
  Succeeded,
  Failed,
  Canceled
}

export class OperatingResult {
  result: OperatingResultType;
  details: string|undefined;
  operator: string;

  private _stack: Array<{
    operator: string,
    result: OperatingResultType,
    details: string|undefined
  }> = [];

  constructor(operator: string, result?: OperatingResultType, details?: string) {
    this.operator = operator;
    this.result = result || OperatingResultType.Null;
    this.details = details;
  }

  update(details: string): OperatingResult;
  update(result: OperatingResultType): OperatingResult;
  update(result: OperatingResultType, details: string): OperatingResult;
  update(resultOrDetails: string|OperatingResultType, details?: string) {
    if (typeof resultOrDetails === 'string') {
      this.details = resultOrDetails;
    } else {
      this.result = resultOrDetails;
      if (details) {
        this.details = details;
      }
    }

    return this;
  }

  push(operatingResult: OperatingResult): OperatingResult;
  push(operator: string, result: OperatingResultType, details?: string): OperatingResult;
  push(operatorOrOperatingResult: string|OperatingResult, result?: OperatingResultType, details?: string) {
    this._stack.push({
      operator: this.operator,
      result: this.result,
      details: this.details
    });

    if (operatorOrOperatingResult instanceof OperatingResult) {
      this.operator = operatorOrOperatingResult.operator;
      this.result = operatorOrOperatingResult.result;
      this.details = operatorOrOperatingResult.details;
      this._stack = this._stack.concat(operatorOrOperatingResult._stack);
    } else {
      if (!result) {
        throw new Error('Result is missing. Availbale results are Success, Failed and Canceled.');
      }
      this.operator = operatorOrOperatingResult;
      this.result = result;
      this.details = details;
    }

    return this;
  }

  append(operatingResult: OperatingResult): OperatingResult;
  append(operator: string, result: OperatingResultType, details?: string): OperatingResult;
  append(operatorOrOperatingResult: string|OperatingResult, result?: OperatingResultType, details?: string) {
    if (operatorOrOperatingResult instanceof OperatingResult) {
      this.result = operatorOrOperatingResult.result;
      this.details = undefined;
      this._stack.push({
        operator: operatorOrOperatingResult.operator,
        result: operatorOrOperatingResult.result,
        details: operatorOrOperatingResult.details
      });
  
      this._stack = this._stack.concat(operatorOrOperatingResult._stack);
    } else {
      if (!result) {
        throw new Error('Result is missing. Availbale results are Success, Failed and Canceled.');
      }
      this.result = result;
      this.details = undefined;
      this._stack.push({
        operator: operatorOrOperatingResult,
        result: result,
        details: details
      });
    }

    return this;
  }

  get isSucceded() {
    return this.result === OperatingResultType.Succeeded;
  }

  get isCanceled() {
    return this.result === OperatingResultType.Canceled;
  }

  get telemetry() {
    const data: {operator: string, result: string, [key: string]: string} = {
      operator: this.operator,
      result: OperatingResultType[this.result]
    };

    let lastDetails: string|undefined;
    const stack: Array<{
      operator: string;
      result: string;
      details?: string;
    }> = [];

    this._stack.map(item => {
      const stackItem: {
        operator: string;
        result: string;
        details?: string;
      } = {
        operator: item.operator,
        result: OperatingResultType[item.result]
      };
      
      if (item.details) {
        stackItem.details = item.details;
        lastDetails = item.details;
      }

      stack.push(stackItem);
    });

    data.operatingStack = JSON.stringify(stack);

    if (this.details) {
      data.errorMessage = this.details;
    } else if (lastDetails) {
      data.errorMessage = lastDetails;
    }

    return data;
  }
}