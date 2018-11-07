//@flow
import m from "mithril"
import stream from "mithril/stream/stream.js"
import type {ButtonAttrs} from "../gui/base/ButtonN"
import {ButtonN, createDropDown} from "../gui/base/ButtonN"
import {AccessBlockedError, NotAuthenticatedError} from "../api/common/error/RestError"
import {showProgressDialog} from "../gui/base/ProgressDialog"
import {isMailAddress} from "../misc/Formatter"
import {ButtonType} from "../gui/base/Button"
import {Type} from "../gui/base/TextField"
import {lang} from "../misc/LanguageViewModel"
import {PasswordForm} from "../settings/PasswordForm"
import {Icons} from "../gui/base/icons/Icons"
import {deviceConfig} from "../misc/DeviceConfig"
import {TextFieldN} from "../gui/base/TextFieldN"
import {Dialog, DialogType} from "../gui/base/Dialog"
import {assertMainOrNode} from "../api/Env"
import {secondFactorHandler} from "./SecondFactorHandler"
import {HtmlEditor, Mode} from "../gui/base/HtmlEditor"

assertMainOrNode()

export function show(loginViewControllerPromise: Promise<ILoginViewController>): Dialog {
	type ResetAction = "password" | "secondFactor"
	const selectedAction: Stream<?ResetAction> = stream(null)
	let passwordForm = new PasswordForm(false, true, true);
	const passwordValueStream = stream("")
	const emailAddressStream = stream("")

	const resetPasswordAction: ButtonAttrs = {
		label: "recoverSetNewPassword_action",
		click: () => {
			selectedAction("password")
		},
		type: ButtonType.Dropdown
	}

	const resetSecondFactorAction: ButtonAttrs = {
		label: "recoverResetFactors_action",
		click: () => {
			selectedAction("secondFactor")
		},
		type: ButtonType.Dropdown
	}


	const resetActionClickHandler = createDropDown(() => [resetPasswordAction, resetSecondFactorAction], 300)
	const resetActionButtonAttrs: ButtonAttrs = {
		label: "action_label",
		click: resetActionClickHandler,
		icon: () => Icons.Edit
	}

	const selectedValueLabelStream = selectedAction.map(v => {
		if (v === "password") {
			return lang.get("recoverSetNewPassword_action")
		} else if (v === "secondFactor") {
			return lang.get("recoverResetFactors_action")
		} else {
			return lang.get("choose_label")
		}
	})

	const editor = new HtmlEditor("recoveryCode_label")
	editor.setMode(Mode.HTML)
	editor.setHtmlMonospace(true)
	editor.setMinHeight(80)
	editor.showBorders()

	const recoverDialog = Dialog.showActionDialog({
		title: lang.get("recover_label"),
		type: DialogType.EditSmall,
		child: {
			view: () => {
				return [
					m(TextFieldN, {label: "mailAddresses_label", value: emailAddressStream}),
					m(editor),
					m(TextFieldN, {
							label: "action_label",
							value: selectedValueLabelStream,
							injectionsRight: () => m(ButtonN, resetActionButtonAttrs),
							disabled: true
						}
					),
					selectedAction() == null
						? null
						: selectedAction() === "password"
						? m(passwordForm)
						: m(TextFieldN,
							{
								label: "password_label",
								type: Type.Password,
								value: passwordValueStream
							})
				]
			}
		},
		okAction: () => {
			const cleanMailAddress = emailAddressStream().trim().toLowerCase()
			const cleanRecoverCodeValue = editor.getValue().replace(/\s/g, '').toLowerCase()
			if (!isMailAddress(cleanMailAddress, true)) {
				Dialog.error("mailAddressInvalid_msg")
			} else if (cleanRecoverCodeValue === "") {
				Dialog.error("recoveryCodeEmpty_msg")
			} else if (selectedAction() === "password") {
				if (passwordForm.getErrorMessageId()) {
					Dialog.error(passwordForm.getErrorMessageId())
				} else {
					showProgressDialog("pleaseWait_msg",
						loginViewControllerPromise.then((controller) => {
							return controller.recoverLogin(
								cleanMailAddress,
								cleanRecoverCodeValue,
								passwordForm.getNewPassword())
						}))
						.then(() => {
							recoverDialog.close()
							deviceConfig.delete(cleanMailAddress)
							m.route.set("/login", {loginWith: cleanMailAddress, noAutoLogin: true})
						})
						.catch(NotAuthenticatedError, () => {
							Dialog.error("invalidPassword_msg")
						})
						.catch(AccessBlockedError, () => {
							Dialog.error("loginFailedOften_msg")
						})
						.finally(() => secondFactorHandler.closeWaitingForSecondFactorDialog())
				}
			} else if (selectedAction() === "secondFactor") {
				const passwordValue = passwordValueStream()
				showProgressDialog("pleaseWait_msg",
					loginViewControllerPromise
						.then((controller) => controller.resetSecondFactors(cleanMailAddress, passwordValue, cleanRecoverCodeValue)))
					.then(() => recoverDialog.close())
					.catch(NotAuthenticatedError, () => {
						Dialog.error("invalidPassword_msg")
					})
					.catch(AccessBlockedError, () => {
						Dialog.error("loginFailedOften_msg")
					})
			}
		},
		allowCancel: true
	})
	return recoverDialog
}