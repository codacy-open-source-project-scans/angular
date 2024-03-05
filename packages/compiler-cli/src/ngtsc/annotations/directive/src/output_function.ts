/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import ts from 'typescript';

import {ErrorCode, FatalDiagnosticError} from '../../../diagnostics';
import {ImportedSymbolsTracker} from '../../../imports';
import {InputOrOutput} from '../../../metadata';
import {ClassMember, ReflectionHost} from '../../../reflection';

import {tryParseInitializerApiMember} from './initializer_functions';
import {parseAndValidateInputAndOutputOptions} from './input_output_parse_options';

/**
 * Attempts to parse a signal output class member. Returns the parsed
 * input mapping if possible.
 */
export function tryParseInitializerBasedOutput(
    member: Pick<ClassMember, 'name'|'value'>, reflector: ReflectionHost,
    importTracker: ImportedSymbolsTracker): {call: ts.CallExpression, metadata: InputOrOutput}|
    null {
  const output =
      tryParseInitializerApiMember(['output', 'ɵoutput'], member, reflector, importTracker);
  if (output === null) {
    return null;
  }
  if (output.isRequired) {
    throw new FatalDiagnosticError(
        ErrorCode.INITIALIZER_API_NO_REQUIRED_FUNCTION, output.call,
        `Output does not support ".required()".`);
  }

  const optionsNode = output.call.arguments[0] as ts.Expression | undefined;
  const options =
      optionsNode !== undefined ? parseAndValidateInputAndOutputOptions(optionsNode) : null;
  const classPropertyName = member.name;

  return {
    call: output.call,
    metadata: {
      // Outputs are not signal-based.
      isSignal: false,
      classPropertyName,
      bindingPropertyName: options?.alias ?? classPropertyName,
    }
  };
}
