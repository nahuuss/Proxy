
<script src="../../Scripts/Core/Jquery.maskedinput-1.3.js" type="text/javascript"></script>
<script src="../../Scripts/Views/CustomFunctions.js"   type="text/javascript"></script>
<script src="../../Scripts/Core/grid.locale-es.js" type="text/javascript"></script>
<script src="../../Scripts/Core/jquery.jqGrid.min.js" type="text/javascript"></script>
<script src="../../Scripts/Core/jqPrint.js" type="text/javascript"></script>
<script src="../../Scripts/Views/fmask-01.js" type="text/javascript"></script>
<script src="../../Scripts/Core/jquery-ui-1.8.13.custom.min.js" type="text/javascript"></script>

<link href="../../Content/css/Core/ui.jqgrid.css" rel="stylesheet" type="text/css" media="screen"  />

  <style type="text/css">
        body
        {
            background-image: url(/Images/);
            background-repeat: no-repeat;
            background-position: top;
            
            overflow:hidden;
        }
        #paginador
        {
            height:30px;
            }
        #Text1
        {
            width: 83px;
        }
        #Text2
        {
            width: 83px;
        }
        
        .ui-icon-circle-triangle-n
        {
            background-position: -31px -192px !important;
        }
        .diarioBtn {
            background-color: #0078b6;
            background: linear-gradient(#2894c9, #005080, #006399);
            border-radius: 32px;
            border-color: black;
            border-style: solid;
            border-width: 0.5px;
            background-position: center center;
            margin-left: 24px;
            width: 94px;
            background-repeat: no-repeat;
            background-attachment: inherit;
            color: #FFFFFF;
            height: 24px; 
            
        }
    </style>

    
      <div id="container">
      <form id="diario">
        <div id="divDDL" style="color:Menu; font-weight:bold;">
            
            <span id="2_lblrol" style="color:#000099;">Subdiarios</span>
                <select id="Subdiario" style="margin-left:25px; width:120px" onchange='$("#mostrar").click()' onkeypress="return tabular(event,this)">
                <option id="option1">General</option>
                <option id="option2">Cajadia</option>
                <option id="option3">Compras</option>
                <option id="option4">Ventas</option>
            </select>

            <span id="2_Label1" style="color:#000066;margin-left:110px">Desde</span>
            <input id="desde" onkeypress="return tabular(event,this)" type="text" style="margin-left:15px; width:90px" /><span id="2_Label2" style="color:#000066;margin-left:15px">Hasta</span>
            <input id="hasta" onkeypress="return tabular(event,this)" type="text" style="margin-left:15px; width:90px"/>
            <br/>
            <br/>


            <button name="mostrar" id="mostrar" type="button" class="diarioBtn" style="margin-left: 5px; !Important">Mostrar</button>

            <button name="printBtn" id="Button1_diario" type="button" onclick="AgregaAsiento();" class="diarioBtn">Agregar</button>

            <button name="printBtn" id="Button2" type="button" onclick="ModificaAsiento()" class="diarioBtn">Modificar</button>


            <button name="printBtn" id="Button3" type="button" onclick="BorrarAsiento()"class="diarioBtn">Borrar</button>

            <button name="printBtn" id="printBtn" type="button" onclick="ImprimirAsiento()" class="diarioBtn">Imprimir</button>
           
           <button name="printCompleteBtn" id="printCompleteBtn" type="button" onclick="ImprimirGrilla()" class="diarioBtn" style="width: 115px; !Important">Imprimir Grilla</button>

            <button name="button" type="button" onclick="$('#dialogBuscador').dialog('open');" class="diarioBtn">Buscar</button> 

            <button name="button" type="button" onclick="$('#AltaAsientos').remove();$('#modal-content').dialog('close'); $('#lista').GridUnload();$('#dialogoPopUp').dialog('close');" class="diarioBtn">Salir</button> 


            <br/>
            <br/>
        </div>
        <table id="lista">
        </table>
         <div id="paginador"></div> 
        </form> 
      </div>

    <script type="text/javascript">
        $("#desde").datepicker({ showOn: 'button', dateFormat: 'dd/mm/yy', buttonImageOnly: true, buttonImage: '../../../../images/date.png' });
        $("#hasta").datepicker({ showOn: 'button', dateFormat: 'dd/mm/yy', buttonImageOnly: true, buttonImage: '../../../../images/date.png' });
          
        jQuery(function ($) {
            $("#desde").mask("99/99/9999");
            $("#hasta").mask("99/99/9999");
        });

        var lastsel = 0;
        var lcurlDiario = "";
        var lcSubsistema = "";
        var tcSubsistema = "";
        var tcSubsistema = "";
        var lcDesde = "";
        var lcHasta = "";
        var lnCodOp = 0;
        var lnNumOp = 0;
        var lcModo = "";
        var decAsiento = 0;
        

        function InicializarLista() {

            var rowsToColor = [];
            $("#lista").jqGrid({
                url: lcurlDiario,
                datatype: "POST", dataType: "json",
                colNames: ['ID', 'CODOP', 'NUMOP', 'CUENTA', 'DEBE', 'HABER', 'CONCEPTO', 'COMPROBANTE', 'CENTRO', 'FECHA', 'ASIENTO', 'CONCEPTO1', 'COMPROBANTE1','', 'Sucursal'],
                colModel: [
                { name: 'ID', index: 'ID', align: 'center', width: 10, sortable: true, hidden: true },
                { name: 'CODOP', index: 'CODOP', align: 'center', width: 10, sortable: true, hidden: true },
                { name: 'NUMOP', index: 'NUMOP', align: 'center', width: 10, sortable: true, hidden: true },
           		{ name: 'CUENTA', index: 'CUENTA', width: 250, sortable: true, formatter: rowColorFormatter },
                { name: 'DEBE', index: 'DEBE', align: 'right', width: 70, sortable: true, formatter: 'number', formatoptions: { decimalPlaces: 2} },
                { name: 'HABER', index: 'HABER', align: 'right', width: 70, sortable: true, formatter: 'number', formatoptions: { decimalPlaces: 2} },
                { name: 'CONCEPTO', index: 'CONCEPTO', width: 205, sortable: true },
                { name: 'COMPROBANTE', index: 'COMPROBANTE', width: 75, sortable: true },
                { name: 'CENTRO', index: 'CENTRO', width: 100, sortable: true },
                { name: 'FECHA', index: 'FECHA', hidden: true },
                { name: 'ASIENTO', index: 'ASIENTO', hidden: true },
                { name: 'CONCEPTO1', index: 'CONCEPTO1', hidden: true },
                { name: 'COMPROBANTE1', index: 'COMPROBANTE1', hidden: true},
                { name: 'ASIENTO1', index: 'ASIENTO1', hidden: true },
                { name: 'SUCURSAL', index: 'SUCURSAL', width: 100, sortable: false}],
                pager: '#paginador',
                rowNum: 5000,
                //rowList: [500, 1000, 1500],
                sortname: 'ID',
                viewrecords: true,
                hidegrid: false,
                width: 1150,
                height: 300,
                sortorder: "asc",
                onSelectRow: function (id) {
                    lastsel = id;
                },
                gridComplete: function () {
                    for (var i = 0; i < rowsToColor.length; i++) {
                        var nAsi = parseFloat($("#" + rowsToColor[i]).find("td").eq(10).html());
                        if (nAsi > 0) {
                            $("#" + rowsToColor[i]).find("td").css("background-color", "lightblue");
                            //       $("#" + rowsToColor[i]).find("td").css("color", "silver");
                            //console.log($($($("#" + rowsToColor[i])[0]).find("td")[4]).html(" "));
                            //console.log($($($("#" + rowsToColor[i])[0]).find("td")[5]).html(" "));
                        }
                    }
                }
            });

            $("#lista").jqGrid('navGrid', '#paginador',
                { edit: false, add: false, del: false, search: false },
                  {},
                  { closeAfterSearch: true, width: "720px", scroll: false, jqModal: false, closeOnEscape: false}
                  ).navSeparatorAdd("#paginador", { sepclass: 'ui-separator', sepcontent: '' });

            function rowColorFormatter(cellValue, options, rowObject) {
                rowsToColor[rowsToColor.length] = options.rowId;
                return cellValue;
            }
        }

        function _success(msg) {
            successDialog = $('<div></div>')
			        .html(msg)
			        .dialog({
			            autoOpen: false,
			            title: 'Confirmación!',
			            height: 55
			        });

            successDialog.dialog("open");
            setTimeout(function () { successDialog.dialog('close'); }, 2000);
        }

        function _showError(msg) {
            errDialog = $('<div></div>')
			    .html(msg)
			    .dialog({
			        autoOpen: false,
			        title: 'Advertencia!!',
			        height: 73
			    });
            errDialog.dialog("open");
            setTimeout(function () { errDialog.dialog('close'); }, 2000);
        }

        function AgregaAsiento() {
            tcSubsistema = $("#Subdiario").val();
            lcModo = "add";

            if (tcSubsistema == "") { _showError("Debe seleccionar un subdiario"); return; }

            _altaAsientoFn.Inicializar("add", tcSubsistema);

            dialogoPopUp.dialog('option', 'title', 'Agregar nuevo asiento');

            dialogoPopUp.dialog('open');
        }
        
        function BorrarAsiento() {

            tcSubsistema = $("#Subdiario").val();

            if (lastsel == 0) { _showError("Debe seleccionar un asiento"); return; }

            lnCodOp = jQuery('#lista').jqGrid('getCell', lastsel, 1);
            lnNumOp = jQuery('#lista').jqGrid('getCell', lastsel, 2);

            if (tcSubsistema == "") { _showError("Debe seleccionar un subdiario"); return; }

            $("#popBorrado").dialog('open');

        }

        function ImprimirAsiento() {

            if (lastsel == 0) { _showError("Debe seleccionar un asiento"); return; }
           
            lnCodOp = jQuery('#lista').jqGrid('getCell', lastsel, 1);
            lnNumOp = jQuery('#lista').jqGrid('getCell', lastsel, 2);

            if (lnNumOp == "") { _showError("Debe seleccionar un asiento"); return; }

            var param1 = $("#Subdiario").val().toString();

            var param = "";
           
            param = param1 + 'Ç' + lnCodOp + 'Ç' + lnNumOp + 'Ç' + jQuery('#lista').jqGrid('getCell', lastsel, 13);

            var _url = "../../Diario/Imprimir?param=" + param + "&format=PDF";

            window.open(_url, "Reporte", "width=800px, height=550px, scrollbars=yes, status=yes, location=no, directory=no, menubar=no, resizable=yes, toolbar=no");
        }

        function ImprimirGrilla() {
            var fechaDesde = $("#desde").val();if (fechaDesde == "") { _showError("Ingrese fecha desde"); return; }
            var fechaHasta = $("#hasta").val(); if (fechaHasta == "") { _showError("Ingrese fecha hasta"); return; }
            var subsistema = $("#Subdiario").val();

            var param = subsistema + 'Ç' + fechaDesde + 'Ç' + fechaHasta;

            var _url = "../../Diario/ImprimirTablaCompleta?param=" + param + "&format=PDF";

            window.open(_url, "Reporte", "width=800px, height=550px, scrollbars=yes, status=yes, location=no, directory=no, menubar=no, resizable=yes, toolbar=no");
        }

        function ModificaAsiento() {

            tcSubsistema = $("#Subdiario").val();

            lcFechaDia = jQuery('#lista').jqGrid('getCell', lastsel, 9);

            lcConcepto = jQuery('#lista').jqGrid('getCell', lastsel, 11);

            lcComprobante = jQuery('#lista').jqGrid('getCell', lastsel, 12);

            if (lastsel == 0) { _showError("Debe seleccionar un asiento"); return; }

            decAsiento = jQuery('#lista').jqGrid('getCell', lastsel, 13);

            if (decAsiento == "0") {
                decAsiento == jQuery('#lista').jqGrid('getCell', lastsel, "ASIENTO");
            }

            lnCodOp = jQuery('#lista').jqGrid('getCell', lastsel, 1);
            lnNumOp = jQuery('#lista').jqGrid('getCell', lastsel, 2);

            if (tcSubsistema == "") { _showError("Debe seleccionar un subdiario"); return; }

            lcModo = "edit";

            validarModificacion(lnCodOp, lnNumOp, tcSubsistema);

            dialogoPopUp.dialog('option', 'title', 'Asiento Nº ' + decAsiento);

            _altaAsientoFn.Inicializar(lcModo, tcSubsistema, lcConcepto, lcComprobante, lcFechaDia, decAsiento, lnCodOp, lnNumOp);
        }

        function validarModificacion(codop,numop,subsis) {

            jQuery.ajax({
                type: "GET",
                async: false,
                url: '../../Diario/ValidateDelete?codop=' + codop + "&numop=" + numop + "&subsistema=" + subsis,
                success: function (data) {

                    if (!data) {
                        dialogoPopUp.dialog('open');
                    }

                }
            });
            
        }

        function tabular(e, obj) {
            tecla = (document.all) ? e.keyCode : e.which;
            if (tecla != 13) return;

            frm = obj.form;
            for (i = 0; i < frm.elements.length; i++)
                if (frm.elements[i] == obj) {
                    if (i == frm.elements.length - 1)
                        i = -1;
                    break
                }
            /*ACA ESTA EL CAMBIO disabled, Y PARA SALTEAR CAMPOS HIDDEN*/
                if ((frm.elements[i + 1].disabled == true) || (frm.elements[i + 1].type == 'hidden'))
                    tabular(e, frm.elements[i + 1]);
                /*ACA ESTA EL CAMBIO readOnly */
                else if (frm.elements[i + 1].readOnly == true)
                    tabular(e, frm.elements[i + 1]);
                else
                    frm.elements[i + 1].focus();
            return false;
        }

        $("#popBorrado").dialog({
                    autoOpen: false,
                    height: 126,
                    title: "Borrar Asiento",
                    width: 400,
                    draggable: false,
                    modal: true,
                    resizable: false,
                    closeOnEscape: true,
                    buttons: {
                        "Si": function () {

                            $.ajax({
                                type: "POST",
                                url: '../../Ejercicio_Activo/ValidateDate?fecha=' + $("#lista").jqGrid('getRowData', $("#lista").jqGrid('getGridParam', 'selrow')).FECHA,
                                async: false,
                                success: function (data) {

                                    if (!data) {
                                        _showLoading();
                                        $.ajax({
                                            type: "POST",
                                            async: false,
                                            data: "&codop=" + lnCodOp + "&numop=" + lnNumOp + "&subsistema=" + tcSubsistema + "&asiento=" + jQuery('#lista').jqGrid('getCell', lastsel, 13),
                                            url: '/Diario/BorrarAsiento',
                                            success: function (response) {
                                                _hideLoading();
                                                if (response == 0) {
                                                    _success("El asiento se borro correctamente")
                                                } else {
                                                    _showError("Se produjo un error al tratar de borrar el asiento.");
                                                }
                                            },
                                            error: function (e, err) {
                                                _hideLoading();
                                                alert(e.responseText);
                                            }
                                        });

                                        $("#mostrar").click();

                                        $("#popBorrado").dialog('close');

                                        $(this).dialog('close');

                                    } else {
                                        _showError("Período contable cerrado.");
                                    }

                                },
                                error: function (e, err) {
                                    alert(e.responseText);
                                }
                            });


                        },
                        "No": function () {

                            //  $("#popBorrado").dialog('close');

                            $(this).dialog('close');
                        }
                    }
                });

        $("#dialogBuscador").dialog({
                    autoOpen: false,
                    height: 250,
                    title: "Buscador",
                    width: 500,
                    draggable: false,
                    modal: true,
                    resizable: false,
                    open: function () {

                        $.ajax({
                            type: "GET",
                            url: "../../DiariosContables/GetTiposOperacion",
                            datatype: "POST", dataType: "json",
                            success: function (responseData) {

                                $("#txtTipo").attr("disabled", "disabled");
                                $("#txtTipo").empty();
                                $("#txtTipo").append('<option value="0"></option>');

                                for (var i = 0; i < responseData.length; i++) {

                                    var val = responseData[i].CODIGO;
                                    var text = responseData[i].NOMBRE;

                                    $("#txtTipo").get(0).options[$("#txtTipo").get(0).options.length] = new Option(text, val);
                                }

                            },
                            error: function (responseData) {
                                if (responseData.length != 0)
                                    alert(responseData);
                            }
                        });

                        var list = $("#dialogBuscador input[type='radio']:checked");
                        for (var i = 0; i < list.length; i++) {
                            var radio = list[i];
                            if ($(radio).attr("checked") == "checked") {
                                $(radio).attr("checked", false);
                            }
                        }

                        $("#txtTipo").attr("disabled", "disabled");
                        $("#txtComp").attr("disabled", "disabled");
                        $("#txtAsiento").attr("disabled", "disabled");
                        $("#txtImpoDesde").attr("disabled", "disabled");
                        $("#txtImpoHasta").attr("disabled", "disabled");
                    },
                    close: function () {
                        $("#txtTipo").empty();
                        $("#txtComp").val("");
                        $("#txtImpoDesde").val("");
                        $("#txtImpoHasta").val("");
                        $("#txtAsiento").val("");
                    },
                    buttons: {
                        "Buscar": function () {
                            var valor = "";

                            switch ($("#dialogBuscador input[type='radio']:checked").attr("id")) {
                                case "comprobante":
                                    valor = $("#txtComp").val();
                                    break;
                                case "asiento":
                                    valor = $("#txtAsiento").val();
                                    break;
                                case "tipo":
                                    valor = $("#txtTipo").val();
                                    break;
                                case "importe":
                                    valor = $("#txtImpoDesde").val() + "," + $("#txtImpoHasta").val();
                                    break;
                                case "concepto":
                                    valor = $("#txtConcepto").val();
                                    break;
                                default:
                                    break;
                            }

                            lcurlDiario = '../../Diario/GetListaFiltrada?lcSubsistema=' + lcSubsistema + '&lcDesde=' + lcDesde +
                                        '&lcHasta=' + lcHasta + "&Campo=" + $("#dialogBuscador input[type='radio']:checked").val() +
                                        "&valor=" + valor;

                            $("#lista").GridUnload();
                            InicializarLista();
                            $("#dialogBuscador").dialog("close");
                        },
                        "Limpiar": function () {
                            lcurlDiario = "";
                            $("#lista").GridUnload();
                            InicializarLista();
                            $("#dialogBuscador").dialog("close");
                        },
                        "Salir": function () {
                            $("#dialogBuscador").dialog("close");
                        }
                    }
                });

     function CloseDialog() {
         dialogoPopUp.dialog("close");
     }

     $("#dialogBuscador input[type='radio']").die().live("change", function () {
         var obj = $(this);

         if (obj.attr("checked") == "checked") {
             switch (obj.attr("id")) {

                 case "tipo":
                     $("#txtTipo").attr("disabled", false);

                     $("#txtComp").attr("disabled", "disabled");
                     $("#txtImpo").attr("disabled", "disabled");
                     $("#txtAsiento").attr("disabled", "disabled");
                     $("#txtComp").val("");
                     $("#txtConcepto").attr("disabled", "disabled").val("");

                     $("#txtImpoDesde").val("");
                     $("#txtImpoHasta").val("");
                     $("#txtAsiento").val("");
                     break;

                 case "comprobante":
                     $("#txtComp").attr("disabled", false);

                     $("#txtTipo").attr("disabled", "disabled");
                     $("#txtImpo").attr("disabled", "disabled");

                     $("#txtImpoDesde").attr("disabled", "disabled");
                     $("#txtImpoHasta").attr("disabled", "disabled");
                     $("#txtAsiento").attr("disabled", "disabled");
                     $("#txtConcepto").attr("disabled", "disabled").val("");
                     $("#txtTipo").val(0);

                     $("#txtImpoDesde").val("");
                     $("#txtImpoHasta").val("");
                     $("#txtAsiento").val("");
                     break;

                 case "asiento":
                     $("#txtAsiento").attr("disabled", false);

                     $("#txtTipo").attr("disabled", "disabled");
                     $("#txtImpo").attr("disabled", "disabled");

                     $("#txtImpoDesde").attr("disabled", "disabled");
                     $("#txtImpoHasta").attr("disabled", "disabled");
                     $("#txtComp").attr("disabled", "disabled");
                     $("#txtConcepto").attr("disabled", "disabled").val("");

                     $("#txtTipo").val(0);

                     $("#txtImpoDesde").val("");
                     $("#txtImpoHasta").val("");
                     $("#txtComp").val("");

                     break;

                 case "importe":
                     $("#txtImpoDesde").attr("disabled", false);
                     $("#txtImpoHasta").attr("disabled", false);

                     $("#txtTipo").attr("disabled", "disabled");
                     $("#txtComp").attr("disabled", "disabled");
                     $("#txtAsiento").attr("disabled", "disabled");
                     $("#txtConcepto").attr("disabled", "disabled").val("");

                     $("#txtTipo").val(0);
                     $("#txtComp").val("");
                     $("#txtAsiento").val("");

                     break;
                 case "concepto":
                     $("#txtImpoDesde").attr("disabled", "disabled").val("");
                     $("#txtImpoHasta").attr("disabled", "disabled").val("");

                     $("#txtTipo").attr("disabled", "disabled").val("");
                     $("#txtComp").attr("disabled", "disabled").val("");
                     $("#txtAsiento").attr("disabled", "disabled").val("");

                     $("#txtConcepto").attr("disabled", false);
                     break;
                 default:
                     break;
             }
         }

     });

     $(document).ready(function () {

         InicializarLista();

         dialogoPopUp = $("#AltaAsientos").dialog({
             autoOpen: false,
             resizable: false,
             height: 600,
             width: 800,
             z_index: 1006,
             top: 130,
             left: 418,
             modal: true,
             buttons: {
                 Aceptar: function () {
                     var _fecha = $("#txtFecha").val();

                     if (_fecha == "") { _showError("Debe ingresar una fecha."); return; }
                        
                     $.ajax({
                         type: "POST",
                         async: false,
                         url: '../../Ejercicio_Activo/ValidateDate?fecha=' + _fecha,
                         success: function (data) {
                            if (!data)
                            {
                             _altaAsientoFn.Save();
                             } else {
                                 _hideLoading();
                                 _showError("Período contable cerrado.");
                             }

                         },
                         error: function (e, err) {
                             alert(e.responseText);
                         }
                     });


                 },
                 Cancelar: function () {
                     // $("#GrillaAltaAsiento").GridDestroy();
                     lnUltId = 0;
                     //$(this).dialog("close");
                     $("#GrillaAltaAsiento").GridUnload();
                     //;
                     $(this).dialog("close");
                 }
             },
             open: function () {

                 //;

             }
         });
     });

     $("#mostrar").die().live('click', function () {

         lcSubsistema = $("#Subdiario").val();

         lcDesde = $("#desde").val();
         lcHasta = $("#hasta").val();

         if (lcSubsistema == "") { _showError("Debe seleccionar un subdiario"); return; }
         if (lcDesde == "") { _showError("La fecha hasta es obligatoria"); return; }
         if (lcHasta == "") { _showError("La fecha hasta es obligatoria"); return; }
         if (!ValidarFecha(lcDesde)) { _showError("La fecha desde no es válida"); return; }
         if (!ValidarFecha(lcHasta)) { _showError("La fecha hasta no es válida"); return; }

         lcurlDiario = '../../Diario/GetLista' + lcSubsistema + '?&lcSubsistema=' + lcSubsistema + '&lcDesde=' + lcDesde + '&lcHasta=' + lcHasta;


         $("#lista").GridUnload();

         InicializarLista();

     });

     $("#desde").val(_currentDate); // Por default, setea la fecha del dia corriente.- 
     $("#hasta").val(_currentDate); // Por default, setea la fecha del dia corriente.- 

    </script>

<div id="AltaAsientos" class="popUp" style="display: none">
    



<style type="text/css">
    .blueBackColor
    {
        background-color: #99CCFF;
        width: 90px;
        text-align: right;
    }
        
</style>

<table id="mainTable">
    <tr>
        <td>Comprobante</td>

        <td><input type="text" id="txtComprobante"/></td>

        <td style="text-align: right">Fecha <input type="text" id="txtFecha" style="margin-left: 10px; text-align: center"/></td>
    </tr>

    <tr>
        <td>Concepto</td>

        <td colspan="4"><input type="text" id="txtConceptoAsiento" style="width: 99%"/></td>
    </tr>

    <tr>
        <td><button id="btnAgregar">Agregar</button></td>

        <td>
            <button id="btnQuitar" style="width: 80px">Quitar</button>
            <button id="btnModelo" style="width: 123px;">Asiento modelo</button>
        </td>

        <td colspan="3" style="text-align: right">
            <table style="margin-left: auto"> 
                <tr>
                    <td>Debe</td>
                    <td><input type="text" id="txtTotalDebe" class="blueBackColor" disabled="disabled"/></td>
                    <td>Haber</td>
                    <td><input type="text" id="txtTotalHaber" class="blueBackColor" disabled="disabled"/></td>
                    <td style="text-align: right">Diferencia</td>
                    <td style="text-align: right"><input type="text" id="txtDiferencia" class="blueBackColor" disabled="disabled"/></td>
                </tr> 
            </table>
        </td>
        
    </tr>

    <tr>
        <td colspan="8">
            <table id="AsientosTable"></table>
        </td>
    </tr>
</table>

<div id="popUpPlanCuentas" class="popUp" style= "display:none">
    

    <script type="text/javascript">

        function buscarPlan(valor) {

        $("#tabla .td-field").parent().hide();
        $("#tabla .td-field").each(function () {

            var valordefila = $(this).html().toLowerCase();
            
            if (valordefila.indexOf(valor.toLowerCase()) >= 0) {
                $(this).parent().show();
            } 

        });

    }

//    $("#txtbuscar").keyup(function () {
//        buscarPlan(this.value);
//    });

</script>

    <div id="tabla">
    Campo a buscar:  <input type="text" id="txtbuscar" style="width:410px;" onkeyup="javascript:buscarPlan(this.value);" tabindex="1" />
    <br /><br />
    
    <hr />

    <table>
        <tr>
            <th>
                CUENTA
            </th>
            <th style="width:300px;">
                DENOMINA
            </th>
            <th>
                GRUPO
            </th>
        </tr>

    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100030000">
                1100030000
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100030000">
                Caja Pesos
            </td>
            <td class="td-field" style="width:100px" id="1100030000">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111003">
                1100111003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111003">
                Moneda Extranjera
            </td>
            <td class="td-field" style="width:100px" id="1100111003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111004">
                1100111004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111004">
                Diferencial Monex
            </td>
            <td class="td-field" style="width:100px" id="1100111004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111009">
                1100111009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111009">
                Fondo Fijo Caba
            </td>
            <td class="td-field" style="width:100px" id="1100111009">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111010">
                1100111010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111010">
                Fondo Fijo Cordoba
            </td>
            <td class="td-field" style="width:100px" id="1100111010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111011">
                1100111011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111011">
                Fondo Fijo Misiones
            </td>
            <td class="td-field" style="width:100px" id="1100111011">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111012">
                1100111012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111012">
                Fondo Fijo Rosario
            </td>
            <td class="td-field" style="width:100px" id="1100111012">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111013">
                1100111013
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111013">
                Fondo Fijo Tucuman
            </td>
            <td class="td-field" style="width:100px" id="1100111013">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111014">
                1100111014
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111014">
                Fondo Fijo Salta
            </td>
            <td class="td-field" style="width:100px" id="1100111014">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100111015">
                1100111015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100111015">
                Fondo Fijo Jujuy
            </td>
            <td class="td-field" style="width:100px" id="1100111015">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112001">
                1100112001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112001">
                Banco Macro C/C
            </td>
            <td class="td-field" style="width:100px" id="1100112001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112004">
                1100112004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112004">
                Banco Macro Cta Especial - Martina
            </td>
            <td class="td-field" style="width:100px" id="1100112004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112005">
                1100112005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112005">
                Banco Macro Cta Especial - Parodi
            </td>
            <td class="td-field" style="width:100px" id="1100112005">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112006">
                1100112006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112006">
                Banco Macro  - Sucursal Rosario
            </td>
            <td class="td-field" style="width:100px" id="1100112006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112007">
                1100112007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112007">
                Banco Macro  - Sucursal Jujuy
            </td>
            <td class="td-field" style="width:100px" id="1100112007">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112008">
                1100112008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112008">
                Banco Macro  - Sucursal Cordoba
            </td>
            <td class="td-field" style="width:100px" id="1100112008">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112010">
                1100112010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112010">
                Banco Macro  - Sucursal Salta
            </td>
            <td class="td-field" style="width:100px" id="1100112010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112011">
                1100112011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112011">
                Banco Macro  - Sucursal Misiones
            </td>
            <td class="td-field" style="width:100px" id="1100112011">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112015">
                1100112015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112015">
                Banco Macro  - Sucursal Tucuman
            </td>
            <td class="td-field" style="width:100px" id="1100112015">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112018">
                1100112018
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112018">
                Banco Macro Recaudacion Seguros
            </td>
            <td class="td-field" style="width:100px" id="1100112018">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112020">
                1100112020
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112020">
                Banco Meridian
            </td>
            <td class="td-field" style="width:100px" id="1100112020">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112021">
                1100112021
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112021">
                Banco Itau
            </td>
            <td class="td-field" style="width:100px" id="1100112021">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112022">
                1100112022
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112022">
                Banco Valo
            </td>
            <td class="td-field" style="width:100px" id="1100112022">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112023">
                1100112023
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112023">
                Banco Cmf
            </td>
            <td class="td-field" style="width:100px" id="1100112023">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112024">
                1100112024
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112024">
                Banco Comafi
            </td>
            <td class="td-field" style="width:100px" id="1100112024">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1100112025">
                1100112025
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1100112025">
                Banco Reba
            </td>
            <td class="td-field" style="width:100px" id="1100112025">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113001">
                1103113001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113001">
                Creditos Asociados ( Capital )
            </td>
            <td class="td-field" style="width:100px" id="1103113001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113002">
                1103113002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113002">
                Creditos Asociados ( Intereses )
            </td>
            <td class="td-field" style="width:100px" id="1103113002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113003">
                1103113003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113003">
                Creditos Asociados ( Iva Intereses )
            </td>
            <td class="td-field" style="width:100px" id="1103113003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113006">
                1103113006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113006">
                Creditos A Imputar
            </td>
            <td class="td-field" style="width:100px" id="1103113006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113007">
                1103113007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113007">
                Operaciones Por Liquidar
            </td>
            <td class="td-field" style="width:100px" id="1103113007">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113010">
                1103113010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113010">
                CONSUMOS PRODUCTOS A LIQUIDAR
            </td>
            <td class="td-field" style="width:100px" id="1103113010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113011">
                1103113011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113011">
                Cp Fideicomiso
            </td>
            <td class="td-field" style="width:100px" id="1103113011">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113012">
                1103113012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113012">
                Cuotas Pendientes A Imputar
            </td>
            <td class="td-field" style="width:100px" id="1103113012">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113013">
                1103113013
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113013">
                Cuotas Pendientes A Cobrar
            </td>
            <td class="td-field" style="width:100px" id="1103113013">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113014">
                1103113014
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113014">
                Seg De Vida Sdo Deudor A Devengar
            </td>
            <td class="td-field" style="width:100px" id="1103113014">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113015">
                1103113015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113015">
                Gs Administracion De Cuota
            </td>
            <td class="td-field" style="width:100px" id="1103113015">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113016">
                1103113016
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113016">
                Iva Gs Administracion De Cuota
            </td>
            <td class="td-field" style="width:100px" id="1103113016">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103113024">
                1103113024
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103113024">
                Vdf Ff 13 Clase B
            </td>
            <td class="td-field" style="width:100px" id="1103113024">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117001">
                1103117001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117001">
                Deudores En Gestion De Cobranza
            </td>
            <td class="td-field" style="width:100px" id="1103117001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117002">
                1103117002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117002">
                Prevision Deudores En Gestion De Cobranza
            </td>
            <td class="td-field" style="width:100px" id="1103117002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117003">
                1103117003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117003">
                Prevision Deudores Incobrables
            </td>
            <td class="td-field" style="width:100px" id="1103117003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117004">
                1103117004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117004">
                Cuotas En Mora
            </td>
            <td class="td-field" style="width:100px" id="1103117004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117005">
                1103117005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117005">
                Cartera Morosa Adquirida
            </td>
            <td class="td-field" style="width:100px" id="1103117005">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117006">
                1103117006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117006">
                Prevision Cartera Cedida
            </td>
            <td class="td-field" style="width:100px" id="1103117006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103117010">
                1103117010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1103117010">
                Deudores En Gestion De Carteras Cedidas
            </td>
            <td class="td-field" style="width:100px" id="1103117010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1103120120">
                1103120120
            </td>
            <td class="td-field" style="padding-left:50px; width:100px;" id="1103120120">
                Capital Refinanciado
            </td>
            <td class="td-field" style="width:100px" id="1103120120">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114001">
                1104114001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114001">
                Iva Credito Fiscal
            </td>
            <td class="td-field" style="width:100px" id="1104114001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114002">
                1104114002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114002">
                Iva Retenciones
            </td>
            <td class="td-field" style="width:100px" id="1104114002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114003">
                1104114003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114003">
                Iva Percepciones
            </td>
            <td class="td-field" style="width:100px" id="1104114003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114004">
                1104114004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114004">
                Iva Saldo A Favor 1er Parrafo
            </td>
            <td class="td-field" style="width:100px" id="1104114004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114005">
                1104114005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114005">
                Iva Saldo A Favor 2do Parrafo
            </td>
            <td class="td-field" style="width:100px" id="1104114005">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114006">
                1104114006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114006">
                Iibb Retenciones
            </td>
            <td class="td-field" style="width:100px" id="1104114006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114007">
                1104114007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114007">
                Iibb Percepciones
            </td>
            <td class="td-field" style="width:100px" id="1104114007">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114008">
                1104114008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114008">
                Iibb Saldo A Favor
            </td>
            <td class="td-field" style="width:100px" id="1104114008">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114009">
                1104114009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114009">
                Impuesto A Las Ganancias Retenciones
            </td>
            <td class="td-field" style="width:100px" id="1104114009">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114010">
                1104114010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114010">
                Impuesto A Las Ganancias Anticipos
            </td>
            <td class="td-field" style="width:100px" id="1104114010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114011">
                1104114011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114011">
                Impuesto A Las Gananacias Saldo A Favor
            </td>
            <td class="td-field" style="width:100px" id="1104114011">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114012">
                1104114012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114012">
                Impuesto A La Ganancia Minima Presunta
            </td>
            <td class="td-field" style="width:100px" id="1104114012">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114013">
                1104114013
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114013">
                Impuesto A La Ganancia Minima Presunta Anticipos
            </td>
            <td class="td-field" style="width:100px" id="1104114013">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114014">
                1104114014
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114014">
                Impuesto A La Ganancia Minima Presunta Saldo A Favor
            </td>
            <td class="td-field" style="width:100px" id="1104114014">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114015">
                1104114015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114015">
                Saldo Computable Imp Deb Y Cred
            </td>
            <td class="td-field" style="width:100px" id="1104114015">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114016">
                1104114016
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114016">
                Retenciones Sufridas Suss
            </td>
            <td class="td-field" style="width:100px" id="1104114016">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114017">
                1104114017
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114017">
                Impuesto A Las Ganancias Percepciones
            </td>
            <td class="td-field" style="width:100px" id="1104114017">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114020">
                1104114020
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114020">
                Intereses A Devengar Moratoria Iva
            </td>
            <td class="td-field" style="width:100px" id="1104114020">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1104114100">
                1104114100
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1104114100">
                Activo Diferido
            </td>
            <td class="td-field" style="width:100px" id="1104114100">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115001">
                1105115001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115001">
                DEUDORES VARIOS
            </td>
            <td class="td-field" style="width:100px" id="1105115001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115002">
                1105115002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115002">
                ACCIONISTAS
            </td>
            <td class="td-field" style="width:100px" id="1105115002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115003">
                1105115003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115003">
                DEPOSITOS EN GARANTIA
            </td>
            <td class="td-field" style="width:100px" id="1105115003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115004">
                1105115004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115004">
                ANTICIPOS A RENDIR
            </td>
            <td class="td-field" style="width:100px" id="1105115004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115005">
                1105115005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115005">
                REINTEGRO DE GASTOS
            </td>
            <td class="td-field" style="width:100px" id="1105115005">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115006">
                1105115006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115006">
                ANTICIPOS DIRECTORIO
            </td>
            <td class="td-field" style="width:100px" id="1105115006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115007">
                1105115007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115007">
                SEGUROS A DEVENGAR
            </td>
            <td class="td-field" style="width:100px" id="1105115007">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115008">
                1105115008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115008">
                SEGUROS PAGADOS POR ADELANTADO
            </td>
            <td class="td-field" style="width:100px" id="1105115008">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1105115010">
                1105115010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1105115010">
                SEGUROS A COBRAR OPCION POR FALLECIMIENTO
            </td>
            <td class="td-field" style="width:100px" id="1105115010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116002">
                1201116002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116002">
                Plazo Fijo En Pesos
            </td>
            <td class="td-field" style="width:100px" id="1201116002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116003">
                1201116003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116003">
                Plazo Fijo En Dolares
            </td>
            <td class="td-field" style="width:100px" id="1201116003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116004">
                1201116004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116004">
                Fondos Comunes De Inversion
            </td>
            <td class="td-field" style="width:100px" id="1201116004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116005">
                1201116005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116005">
                Otras Inversiones
            </td>
            <td class="td-field" style="width:100px" id="1201116005">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116006">
                1201116006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116006">
                Bonos Tesoro
            </td>
            <td class="td-field" style="width:100px" id="1201116006">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116009">
                1201116009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116009">
                Fondo Reserva Fideicomiso Financiero
            </td>
            <td class="td-field" style="width:100px" id="1201116009">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116010">
                1201116010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116010">
                Adelantos Fideicomiso
            </td>
            <td class="td-field" style="width:100px" id="1201116010">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1201116012">
                1201116012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1201116012">
                Sobreintegracion Ff S 13
            </td>
            <td class="td-field" style="width:100px" id="1201116012">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202122001">
                1202122001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202122001">
                Gastos De Organizacion
            </td>
            <td class="td-field" style="width:100px" id="1202122001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202122002">
                1202122002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202122002">
                Amort Acumulada Gastos De Organizacion
            </td>
            <td class="td-field" style="width:100px" id="1202122002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202123001">
                1202123001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202123001">
                Hardware Valor Origen
            </td>
            <td class="td-field" style="width:100px" id="1202123001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202123002">
                1202123002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202123002">
                Amort Acumulada Hardware
            </td>
            <td class="td-field" style="width:100px" id="1202123002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202124001">
                1202124001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202124001">
                Software Valor Origen
            </td>
            <td class="td-field" style="width:100px" id="1202124001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202124002">
                1202124002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202124002">
                Amort Acumulada Software
            </td>
            <td class="td-field" style="width:100px" id="1202124002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202125001">
                1202125001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202125001">
                Rodados Valor Origen
            </td>
            <td class="td-field" style="width:100px" id="1202125001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202125002">
                1202125002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202125002">
                Amort Acumulada Rodados
            </td>
            <td class="td-field" style="width:100px" id="1202125002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202126001">
                1202126001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202126001">
                Muebles Y Utiles Valor Origen
            </td>
            <td class="td-field" style="width:100px" id="1202126001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202126002">
                1202126002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202126002">
                Amort Acumulada Muebles Y Utiles
            </td>
            <td class="td-field" style="width:100px" id="1202126002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202127001">
                1202127001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202127001">
                Instalaciones Valor Origen
            </td>
            <td class="td-field" style="width:100px" id="1202127001">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202127002">
                1202127002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202127002">
                Amort Acumulada Instalaciones
            </td>
            <td class="td-field" style="width:100px" id="1202127002">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202127003">
                1202127003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202127003">
                Mejoras Sobre Inmbuebles De 3eros
            </td>
            <td class="td-field" style="width:100px" id="1202127003">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="1202127004">
                1202127004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="1202127004">
                Amort Acumulada Mejoras Sobre Inm De Terceros
            </td>
            <td class="td-field" style="width:100px" id="1202127004">
                ACTIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211001">
                2101211001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211001">
                Proveedores Varios
            </td>
            <td class="td-field" style="width:100px" id="2101211001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211004">
                2101211004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211004">
                Retenciones Liq Prestamo
            </td>
            <td class="td-field" style="width:100px" id="2101211004">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211005">
                2101211005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211005">
                Ret Seguro Vida Colectivo
            </td>
            <td class="td-field" style="width:100px" id="2101211005">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211006">
                2101211006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211006">
                Seg De Vida Sdo Deudor A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2101211006">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211009">
                2101211009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211009">
                Provision Para Gastos
            </td>
            <td class="td-field" style="width:100px" id="2101211009">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211010">
                2101211010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211010">
                Seguros Smg A Renir
            </td>
            <td class="td-field" style="width:100px" id="2101211010">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101211015">
                2101211015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101211015">
                Dividendos De Terceros A Devolver
            </td>
            <td class="td-field" style="width:100px" id="2101211015">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214001">
                2101214001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214001">
                Banco Macro S.A.
            </td>
            <td class="td-field" style="width:100px" id="2101214001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214002">
                2101214002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214002">
                Banco Macro S.A. - Precancelaciones -
            </td>
            <td class="td-field" style="width:100px" id="2101214002">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214052">
                2101214052
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214052">
                Fideicomiso Serie 13 (Capital)
            </td>
            <td class="td-field" style="width:100px" id="2101214052">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214053">
                2101214053
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214053">
                Fideicomiso Serie 13 (Intereses)
            </td>
            <td class="td-field" style="width:100px" id="2101214053">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214054">
                2101214054
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214054">
                Fideicomiso Serie 13  Precancelaciones (Capital)
            </td>
            <td class="td-field" style="width:100px" id="2101214054">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101214055">
                2101214055
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101214055">
                Fideicomiso Serie 13 Precancelaciones (Intereses) -
            </td>
            <td class="td-field" style="width:100px" id="2101214055">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101215001">
                2101215001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101215001">
                Otras Deudas
            </td>
            <td class="td-field" style="width:100px" id="2101215001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101215005">
                2101215005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101215005">
                Comi Mutual A Reintegrar
            </td>
            <td class="td-field" style="width:100px" id="2101215005">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101215006">
                2101215006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101215006">
                Devolucion A Terceros Por Precancelacion
            </td>
            <td class="td-field" style="width:100px" id="2101215006">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101221001">
                2101221001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101221001">
                Intereses Cred Y Gtos A Devengar
            </td>
            <td class="td-field" style="width:100px" id="2101221001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101221002">
                2101221002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101221002">
                Intereses A Devengar
            </td>
            <td class="td-field" style="width:100px" id="2101221002">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101221003">
                2101221003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101221003">
                Iva A Devengar Por Intereses
            </td>
            <td class="td-field" style="width:100px" id="2101221003">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101221008">
                2101221008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101221008">
                Gs Administracion De Cuota A Devengar
            </td>
            <td class="td-field" style="width:100px" id="2101221008">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2101221009">
                2101221009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2101221009">
                Iva A Devengar Gs Administracion De Cuota
            </td>
            <td class="td-field" style="width:100px" id="2101221009">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230001">
                2102230001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230001">
                Sueldos A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2102230001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230002">
                2102230002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230002">
                Cargas Sociales A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2102230002">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230003">
                2102230003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230003">
                Otras Deudas De Personal
            </td>
            <td class="td-field" style="width:100px" id="2102230003">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230004">
                2102230004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230004">
                Provision Vacaciones
            </td>
            <td class="td-field" style="width:100px" id="2102230004">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230005">
                2102230005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230005">
                Prevision Para Juicios
            </td>
            <td class="td-field" style="width:100px" id="2102230005">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230006">
                2102230006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230006">
                Provision Bonos
            </td>
            <td class="td-field" style="width:100px" id="2102230006">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2102230007">
                2102230007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2102230007">
                Liquidaciones Finales A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2102230007">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240001">
                2103240001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240001">
                Iva Debito Fiscal
            </td>
            <td class="td-field" style="width:100px" id="2103240001">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240002">
                2103240002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240002">
                Iva A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240002">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240003">
                2103240003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240003">
                Iva Retenciones A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240003">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240004">
                2103240004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240004">
                Iva Percepciones A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240004">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240005">
                2103240005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240005">
                Iva Df A Devengar
            </td>
            <td class="td-field" style="width:100px" id="2103240005">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240006">
                2103240006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240006">
                Iibb A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240006">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240007">
                2103240007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240007">
                Ret Iibb A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240007">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240008">
                2103240008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240008">
                Ret Ganancias A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240008">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240009">
                2103240009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240009">
                Ret Sellados A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240009">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240010">
                2103240010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240010">
                Provision Impuesto A Las Ganancias
            </td>
            <td class="td-field" style="width:100px" id="2103240010">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240011">
                2103240011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240011">
                Ret Suss A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240011">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240012">
                2103240012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240012">
                Ret Municipal Posadas A Depositar
            </td>
            <td class="td-field" style="width:100px" id="2103240012">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240013">
                2103240013
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240013">
                Ret Iibb Posadas A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240013">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240014">
                2103240014
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240014">
                Ret Iibb Jujuy A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240014">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240015">
                2103240015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240015">
                Obligaciones Impositivas A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240015">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240016">
                2103240016
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240016">
                Moratoria Iva Afip A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240016">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2103240017">
                2103240017
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2103240017">
                Plan De Pagos Afip A Pagar
            </td>
            <td class="td-field" style="width:100px" id="2103240017">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2104211003">
                2104211003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2104211003">
                Deudas Bancarias Y Financieras
            </td>
            <td class="td-field" style="width:100px" id="2104211003">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="2104211007">
                2104211007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="2104211007">
                Deuda Por Underwriting Ff
            </td>
            <td class="td-field" style="width:100px" id="2104211007">
                PASIVOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101311002">
                3101311002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101311002">
                Capital Integrado
            </td>
            <td class="td-field" style="width:100px" id="3101311002">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101311003">
                3101311003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101311003">
                Ajuste De Capital
            </td>
            <td class="td-field" style="width:100px" id="3101311003">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101312001">
                3101312001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101312001">
                Reserva Legal
            </td>
            <td class="td-field" style="width:100px" id="3101312001">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101312002">
                3101312002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101312002">
                Reserva Estatutaria
            </td>
            <td class="td-field" style="width:100px" id="3101312002">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101312003">
                3101312003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101312003">
                Reserva Facultativa
            </td>
            <td class="td-field" style="width:100px" id="3101312003">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101313001">
                3101313001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101313001">
                Resultado Del Ejercicio
            </td>
            <td class="td-field" style="width:100px" id="3101313001">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101313002">
                3101313002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101313002">
                Resultado De Ejercicios Anteriores
            </td>
            <td class="td-field" style="width:100px" id="3101313002">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3101313003">
                3101313003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3101313003">
                Resultados No Asignados
            </td>
            <td class="td-field" style="width:100px" id="3101313003">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3200611001">
                3200611001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3200611001">
                Capital Cartera Vendida Con Responsabilidad
            </td>
            <td class="td-field" style="width:100px" id="3200611001">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3200611002">
                3200611002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3200611002">
                Contracuenta  Capital Cartera Vendida Con Responsabilidad
            </td>
            <td class="td-field" style="width:100px" id="3200611002">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3200611005">
                3200611005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3200611005">
                Intereses De Cartera Vendida Con Responsabilidad
            </td>
            <td class="td-field" style="width:100px" id="3200611005">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="3200611006">
                3200611006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="3200611006">
                Contracuenta Interes De Cartera Vendida Con Responsabilidad
            </td>
            <td class="td-field" style="width:100px" id="3200611006">
                PN
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511001">
                4101511001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511001">
                Utilidad Cesion Cartera
            </td>
            <td class="td-field" style="width:100px" id="4101511001">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511002">
                4101511002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511002">
                Gastos Administrativos Cobrados
            </td>
            <td class="td-field" style="width:100px" id="4101511002">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511003">
                4101511003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511003">
                Intereses Prestamos Devengados
            </td>
            <td class="td-field" style="width:100px" id="4101511003">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511005">
                4101511005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511005">
                Redondeo De Imputaciones
            </td>
            <td class="td-field" style="width:100px" id="4101511005">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511007">
                4101511007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511007">
                Gastos Por Precancelacion Cobrados
            </td>
            <td class="td-field" style="width:100px" id="4101511007">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511008">
                4101511008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511008">
                Gastos Administracion De Cuota Devengados
            </td>
            <td class="td-field" style="width:100px" id="4101511008">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511009">
                4101511009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511009">
                Gestion De Cobranzas
            </td>
            <td class="td-field" style="width:100px" id="4101511009">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101511010">
                4101511010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101511010">
                RECUPERO POR GESTION DE COBRANZAS
            </td>
            <td class="td-field" style="width:100px" id="4101511010">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4101512004">
                4101512004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4101512004">
                Utilidad Por Recompra
            </td>
            <td class="td-field" style="width:100px" id="4101512004">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4102512001">
                4102512001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4102512001">
                Utilidad Otras Operaciones
            </td>
            <td class="td-field" style="width:100px" id="4102512001">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4102512003">
                4102512003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4102512003">
                Diferencia De Cambio
            </td>
            <td class="td-field" style="width:100px" id="4102512003">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4103512005">
                4103512005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4103512005">
                Subarrendamiento Oficinas
            </td>
            <td class="td-field" style="width:100px" id="4103512005">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4104512006">
                4104512006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4104512006">
                Resultado Inversion Fideicomiso
            </td>
            <td class="td-field" style="width:100px" id="4104512006">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4104512009">
                4104512009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4104512009">
                Resultado Vdf Ff V Clase B
            </td>
            <td class="td-field" style="width:100px" id="4104512009">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="4105522015">
                4105522015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="4105522015">
                Comision Servicios Agente Institorio
            </td>
            <td class="td-field" style="width:100px" id="4105522015">
                INGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411004">
                5101411004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411004">
                Bonificaciones
            </td>
            <td class="td-field" style="width:100px" id="5101411004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411005">
                5101411005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411005">
                Bonificaciones Por Fallecimiento
            </td>
            <td class="td-field" style="width:100px" id="5101411005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411006">
                5101411006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411006">
                Creditos Incobrables
            </td>
            <td class="td-field" style="width:100px" id="5101411006">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411007">
                5101411007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411007">
                Prevision Cartera Cedida
            </td>
            <td class="td-field" style="width:100px" id="5101411007">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411009">
                5101411009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411009">
                Prevision Deudores En Gestion De Cobranza
            </td>
            <td class="td-field" style="width:100px" id="5101411009">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411010">
                5101411010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411010">
                Resultado Colocacion Vdf
            </td>
            <td class="td-field" style="width:100px" id="5101411010">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411011">
                5101411011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411011">
                Deudores Descarte
            </td>
            <td class="td-field" style="width:100px" id="5101411011">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411015">
                5101411015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411015">
                Comisiones Mutuales
            </td>
            <td class="td-field" style="width:100px" id="5101411015">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411020">
                5101411020
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411020">
                Int. Perdidos Por Cancelaci&#243;n Anticipada De Cr&#233;ditos Cedidos
            </td>
            <td class="td-field" style="width:100px" id="5101411020">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411025">
                5101411025
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411025">
                Intereses Perdidos Por Baja Contable De Cr&#233;ditos Cedidos
            </td>
            <td class="td-field" style="width:100px" id="5101411025">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101411027">
                5101411027
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101411027">
                Intereses Perdidos Por Fallecimiento De Cr&#233;ditos Cedidos
            </td>
            <td class="td-field" style="width:100px" id="5101411027">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101412020">
                5101412020
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101412020">
                Embargos
            </td>
            <td class="td-field" style="width:100px" id="5101412020">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101413008">
                5101413008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101413008">
                Honorarios Por Gesti&#243;n De Cobranza
            </td>
            <td class="td-field" style="width:100px" id="5101413008">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101416002">
                5101416002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101416002">
                Impuesto A Los Debitos Y Creditos Bancarios
            </td>
            <td class="td-field" style="width:100px" id="5101416002">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5101416004">
                5101416004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5101416004">
                Ajuste Redondeo Mutuales
            </td>
            <td class="td-field" style="width:100px" id="5101416004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102412001">
                5102412001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102412001">
                Sueldos Y Jornales
            </td>
            <td class="td-field" style="width:100px" id="5102412001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102412002">
                5102412002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102412002">
                Cargas Sociales
            </td>
            <td class="td-field" style="width:100px" id="5102412002">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102412003">
                5102412003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102412003">
                Otros Gastos De Personal
            </td>
            <td class="td-field" style="width:100px" id="5102412003">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102412014">
                5102412014
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102412014">
                Gratificaciones Especiales
            </td>
            <td class="td-field" style="width:100px" id="5102412014">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102413015">
                5102413015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102413015">
                Honorarios Internos
            </td>
            <td class="td-field" style="width:100px" id="5102413015">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5102417007">
                5102417007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5102417007">
                Capacitacion Del Personal
            </td>
            <td class="td-field" style="width:100px" id="5102417007">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103412004">
                5103412004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103412004">
                Movilidad Y Viaticos
            </td>
            <td class="td-field" style="width:100px" id="5103412004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103412006">
                5103412006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103412006">
                Refrigerios
            </td>
            <td class="td-field" style="width:100px" id="5103412006">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103412007">
                5103412007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103412007">
                Gastos De Representacion
            </td>
            <td class="td-field" style="width:100px" id="5103412007">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103413004">
                5103413004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103413004">
                Informes Comerciales
            </td>
            <td class="td-field" style="width:100px" id="5103413004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103413010">
                5103413010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103413010">
                Gastos De Publicidad
            </td>
            <td class="td-field" style="width:100px" id="5103413010">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103413011">
                5103413011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103413011">
                Gastos Call Center
            </td>
            <td class="td-field" style="width:100px" id="5103413011">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5103417008">
                5103417008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5103417008">
                Comisiones Varias
            </td>
            <td class="td-field" style="width:100px" id="5103417008">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104412005">
                5104412005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104412005">
                Gastos Administrativos
            </td>
            <td class="td-field" style="width:100px" id="5104412005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104412008">
                5104412008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104412008">
                Gastos De Libreria
            </td>
            <td class="td-field" style="width:100px" id="5104412008">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104412009">
                5104412009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104412009">
                Gastos De Mantenimiento
            </td>
            <td class="td-field" style="width:100px" id="5104412009">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104412011">
                5104412011
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104412011">
                Gastos De Certificacion, Rubricas Y Sellos
            </td>
            <td class="td-field" style="width:100px" id="5104412011">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104412012">
                5104412012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104412012">
                Gastos Varios
            </td>
            <td class="td-field" style="width:100px" id="5104412012">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104413001">
                5104413001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104413001">
                Gastos Mantenimiento De Sistemas
            </td>
            <td class="td-field" style="width:100px" id="5104413001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104413003">
                5104413003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104413003">
                Comunicaci&#243;n, Conectividad Y Telefon&#237;a
            </td>
            <td class="td-field" style="width:100px" id="5104413003">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417001">
                5104417001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417001">
                Gastos De Envio
            </td>
            <td class="td-field" style="width:100px" id="5104417001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417002">
                5104417002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417002">
                Seguros
            </td>
            <td class="td-field" style="width:100px" id="5104417002">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417003">
                5104417003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417003">
                Alquiler Oficinas
            </td>
            <td class="td-field" style="width:100px" id="5104417003">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417004">
                5104417004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417004">
                Expensas
            </td>
            <td class="td-field" style="width:100px" id="5104417004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417005">
                5104417005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417005">
                Alquiler De Equipos
            </td>
            <td class="td-field" style="width:100px" id="5104417005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417006">
                5104417006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417006">
                Gastos De Oficina
            </td>
            <td class="td-field" style="width:100px" id="5104417006">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5104417009">
                5104417009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5104417009">
                Gastos De Servicios
            </td>
            <td class="td-field" style="width:100px" id="5104417009">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5105413005">
                5105413005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5105413005">
                Honorarios Profesionales
            </td>
            <td class="td-field" style="width:100px" id="5105413005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5105413006">
                5105413006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5105413006">
                Honorarios Contables
            </td>
            <td class="td-field" style="width:100px" id="5105413006">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5105413007">
                5105413007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5105413007">
                Honorarios Legales
            </td>
            <td class="td-field" style="width:100px" id="5105413007">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5105413012">
                5105413012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5105413012">
                Honorarios Directores
            </td>
            <td class="td-field" style="width:100px" id="5105413012">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5105413020">
                5105413020
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5105413020">
                Honorarios Sistemas
            </td>
            <td class="td-field" style="width:100px" id="5105413020">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5106411012">
                5106411012
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5106411012">
                Recpam
            </td>
            <td class="td-field" style="width:100px" id="5106411012">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5106412010">
                5106412010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5106412010">
                Impuestos, Tasas Y Contribuciones
            </td>
            <td class="td-field" style="width:100px" id="5106412010">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5106412013">
                5106412013
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5106412013">
                Impuesto A Los Ingresos Brutos
            </td>
            <td class="td-field" style="width:100px" id="5106412013">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5106414001">
                5106414001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5106414001">
                Impuesto A Las Ganancias
            </td>
            <td class="td-field" style="width:100px" id="5106414001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5106416008">
                5106416008
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5106416008">
                Impuesto Bienes Personales Y Participaciones
            </td>
            <td class="td-field" style="width:100px" id="5106416008">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107070800">
                5107070800
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107070800">
                Intereses y Comisiones Cesion Cartera
            </td>
            <td class="td-field" style="width:100px" id="5107070800">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416001">
                5107416001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416001">
                Gastos Bancarios
            </td>
            <td class="td-field" style="width:100px" id="5107416001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416003">
                5107416003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416003">
                Intereses Y Actualizaciones
            </td>
            <td class="td-field" style="width:100px" id="5107416003">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416005">
                5107416005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416005">
                Gastos Bancarios Uw X Ff
            </td>
            <td class="td-field" style="width:100px" id="5107416005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416006">
                5107416006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416006">
                Intereses Por Prestamos Recibidos
            </td>
            <td class="td-field" style="width:100px" id="5107416006">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416007">
                5107416007
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416007">
                Intereses Y Gastos Por Cauciones
            </td>
            <td class="td-field" style="width:100px" id="5107416007">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416009">
                5107416009
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416009">
                Intereses Y Gastos Por Pagares Bursatiles
            </td>
            <td class="td-field" style="width:100px" id="5107416009">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5107416010">
                5107416010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5107416010">
                Intereses Por Alquiler De Titulos Y Acciones
            </td>
            <td class="td-field" style="width:100px" id="5107416010">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5108412015">
                5108412015
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5108412015">
                Servicios Sociales Productores Seguros Ret
            </td>
            <td class="td-field" style="width:100px" id="5108412015">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5109417010">
                5109417010
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5109417010">
                Donaciones
            </td>
            <td class="td-field" style="width:100px" id="5109417010">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415001">
                5110415001
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415001">
                Amortizacion Muebles Y Utiles
            </td>
            <td class="td-field" style="width:100px" id="5110415001">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415002">
                5110415002
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415002">
                Amortizacion Software
            </td>
            <td class="td-field" style="width:100px" id="5110415002">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415003">
                5110415003
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415003">
                Amortizacion Instalaciones
            </td>
            <td class="td-field" style="width:100px" id="5110415003">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415004">
                5110415004
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415004">
                Amortizacion Mejoras Sobre Inm De Terceros
            </td>
            <td class="td-field" style="width:100px" id="5110415004">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415005">
                5110415005
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415005">
                Amortizacion Hardware
            </td>
            <td class="td-field" style="width:100px" id="5110415005">
                EGRESOS
            </td>

        </tr>
    
    
        
        <tr>
            <td class="td-field" style="width:100px" id="5110415006">
                5110415006
            </td>
            <td class="td-field" style="padding-left:40px; width:100px;" id="5110415006">
                Amortizacion Rodados
            </td>
            <td class="td-field" style="width:100px" id="5110415006">
                EGRESOS
            </td>

        </tr>
    
    

    </table>
  
  </div>


</div>

<div id="popUpCentro" class="popUp" style= "display:none">
    

    <script type="text/javascript">

        function buscarCosto(valor) {

        $("#tablaCosto .td-fieldCentroCosto").parent().hide();
        $("#tablaCosto .td-fieldCentroCosto").each(function () {
            var valordefila = $(this).html().toLowerCase();
            if (valordefila.indexOf(valor.toLowerCase()) >= 0) $(this).parent().show();
        });

    }

    $("#txtbuscarCosto").keyup(function () {

        buscarCosto($(this).val());
        
    });

</script>
    
    <div id="tablaCosto">
    Campo a buscar:  <input type="text" id="txtbuscarCosto" />
    <br /><br />
    
    <hr />
    <table style="width: 100%">
        <tr>
            <th>
                Cuenta
            </th>
            <th style="width:300px;">
                Denomina
            </th>            
        </tr>

    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001010000">
                5001010000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001010000">
                Casa Central 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001020000">
                5001020000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001020000">
                Salta 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002010000">
                5002010000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002010000">
                Administraci&#243;n y Contabilidad 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002020000">
                5002020000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002020000">
                Tesorer&#237;a 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002030000">
                5002030000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002030000">
                Finanzas 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002040000">
                5002040000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002040000">
                Cobranzas 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002050000">
                5002050000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002050000">
                Sistema IT 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002060000">
                5002060000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002060000">
                Capital Humano 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002070000">
                5002070000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002070000">
                Comercial  
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002080000">
                5002080000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002080000">
                Auditoria 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002090000">
                5002090000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002090000">
                Operaciones 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001030000">
                5001030000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001030000">
                Jujuy 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001040000">
                5001040000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001040000">
                Tucuman 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001050000">
                5001050000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001050000">
                Misiones 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001060000">
                5001060000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001060000">
                Cordoba 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001070000">
                5001070000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001070000">
                Santa Fe 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001080000">
                5001080000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001080000">
                Tinogasta 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001090000">
                5001090000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001090000">
                Valle Viejo 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001100000">
                5001100000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001100000">
                Recreo 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001110000">
                5001110000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5001110000">
                Buenos Aires 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002100000">
                5002100000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002100000">
                Directorio 
            </td>

        </tr>
    
    
        
        <tr class="tr-field">
            
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002110000">
                5002110000 
            </td>
            <td class="td-fieldCentroCosto" style="width:100px; text-align:center;" id=" 5002110000">
                Gerencia Gral 
            </td>

        </tr>
    
    

    </table>
  
  </div>


</div>

<div id="popUpAsientoModelo">

    <table border="0" cellpadding="5" cellspacing="0">
        <thead>
            <tr>
                <th>Modelos</th>
            </tr>
        </thead>
        <tbody>
            
            <tr>
                <td>
                    <hr />
                </td>
            </tr>
            

                <tr id="42">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="42" >
                        Asiento de cierre de IVA
                    </td>

                </tr>
    
            

                <tr id="43">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="43" >
                        Asiento de devengamiento de IIBB
                    </td>

                </tr>
    
            

                <tr id="41">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="41" >
                        Asiento de sueldos
                    </td>

                </tr>
    
            

                <tr id="181">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="181" >
                        COBRANZAS 
                    </td>

                </tr>
    
            

                <tr id="281">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="281" >
                        COMISION POR VENTA EVENTOS
                    </td>

                </tr>
    
            

                <tr id="241">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="241" >
                        COMISIONES CREDICOM
                    </td>

                </tr>
    
            

                <tr id="261">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="261" >
                        COMISIONES MUTUAL MUNICIPAL
                    </td>

                </tr>
    
            

                <tr id="221">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="221" >
                        FACTURAS EMITIDAS
                    </td>

                </tr>
    
            

                <tr id="201">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="201" >
                        OPERACIONES DE FINANZAS
                    </td>

                </tr>
    
            

                <tr id="161">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="161" >
                        PAGO DEUDAS IMPOSITIVAS
                    </td>

                </tr>
    
            

                <tr id="301">
            
                    <td class="td-field" style="width:90%; text-align:left;" id="301" >
                        RECLASIF FACTURAS EMITIDAS
                    </td>

                </tr>
    
            
        </tbody>
    </table>

</div>

<script type="text/javascript">
    var _altaAsientoFn = {
        GridSelector: $("#AsientosTable"),
        LastRowId: 0,
        IdCount: 1,
        PartialViewMode: "",
        Subsistema: "",
        NroAsiento: 0,
        esGeneral: '',

        PlanCuentasDialog: $("#popUpPlanCuentas").dialog({ autoOpen: false,
            resizable: false,
            height: 310.733,
            width: 558.733,
            z_index: 1006,
            top: 130,
            left: 418,
            modal: true,
            buttons: {
                Cancel: function () {
                    this.dialog("close");
                }
            }
        }),

        OpenPlanCuentasDialog: function () {
            _altaAsientoFn.PlanCuentasDialog.dialog("open");
        },

        CentroCostoDialog: $("#popUpCentro").dialog({ autoOpen: false,
            resizable: false,
            height: 310.733,
            width: 558.733,
            z_index: 1006,
            top: 130,
            left: 418,
            modal: true,
            buttons: {
                Vacio: function () {
                    $(this).dialog("close");

                },
                Cancelar: function () {
                    $(this).dialog("close");
                }
            }
        }),

        OpenCentroCostoDialog: function () {
            _altaAsientoFn.CentroCostoDialog.dialog("open");
        },

        CalcularTotales: function (event) {
            var gridData = _altaAsientoFn.GridSelector.jqGrid('getGridParam', 'data');
            debugger;
            if (!isEmpty(event)) {
                var monto = isEmpty(parseFloat($(event.target).val())) ? 0 : parseFloat($(event.target).val());

                var name = $(event.target).attr("name")
                var editedRowId = $(event.target).parent().parent().attr("id");

                var montoTotal = 0;

                $.each(gridData, function (index, item) {
                    if (!(editedRowId == item.id)) {
                        if (name == "DEBE")
                            montoTotal += parseFloat(item.DEBE);
                        else if (name == "HABER")
                            montoTotal += parseFloat(item.HABER);
                    }
                });

                if (name == "DEBE") {
                    $("#txtTotalDebe").val((monto + montoTotal).toFixed(2));
                } else if (name == "HABER") {
                    $("#txtTotalHaber").val((monto + montoTotal).toFixed(2));
                }

                var debe = parseFloat($("#txtTotalDebe").val());
                var haber = parseFloat($("#txtTotalHaber").val());

                $("#txtDiferencia").val((debe - haber).toFixed(2));
            }
            else {
                var totalDebe = 0;
                var totalHaber = 0;

                $.each(gridData, function (index, item) {
                    totalDebe += parseFloat(item.DEBE);
                    totalHaber += parseFloat(item.HABER);
                });

                $("#txtTotalDebe").val(totalDebe.toFixed(2));
                $("#txtTotalHaber").val(totalHaber.toFixed(2));
                $("#txtDiferencia").val((totalHaber - totalDebe).toFixed(2));
            }
        },

        CreateGrid: function () {
            _altaAsientoFn.GridSelector.jqGrid({
                datatype: "local",
                data: _altaAsientoFn.GridData,
                editurl: 'clientArray',
                cellurl: 'clientArray',
                cellsubmit: 'clientArray',
                //cellEdit: true,
                height: 375,
                width: 775,
                colNames: ['nroAsiento', 'isDel', 'Cuenta', 'Denominación', 'Debe', 'Haber', 'idcentro', 'Centro de Costo', 'Concepto'],
                colModel: [
                        { name: 'NRO_ASIENTO', index: 'NRO_ASIENTO', hidden: true, editable: false },
                        { name: 'IS_DELETED', index: 'IS_DELETED', hidden: true, editable: true },
                        { name: 'CUENTA', index: 'CUENTA', align: "right", width: 100, editable: true,
                            editoptions:
                            {
                                dataEvents: [
                                { type: 'dblclick',
                                    fn: _altaAsientoFn.OpenPlanCuentasDialog
                                }]
                            }
                        },
                        { name: 'DENOMINA', index: 'DENOMINA', width: 250, editable: false },
                        { name: 'DEBE', index: 'DEBE', align: "right", width: 100, editable: true, edittype: 'text', formatter: 'number', formatoptions: { decimalPlaces: 2 },
                            editoptions:
                                {
                                    dataEvents: [
                                    { type: 'focusout',
                                        fn: _altaAsientoFn.CalcularTotales
                                    }]
                                }
                        },
                        { name: 'HABER', index: 'HABER', align: "right", width: 100, editable: true, edittype: 'text', formatter: 'number', formatoptions: { decimalPlaces: 2 },
                            editoptions:
                                {
                                    dataEvents: [
                                    { type: 'focusout',
                                        fn: _altaAsientoFn.CalcularTotales
                                    }]
                                }
                        },
                        { name: 'ID_CENTRO', index: 'ID_CENTRO', align: "right", hidden: true, editable: true },
                        { name: 'CENTRO', index: 'CENTRO', align: "left", width: 210, editable: true, edittype: 'text',
                            editoptions:
                            {
                                dataEvents: [
                                { type: 'dblclick',
                                    fn: _altaAsientoFn.OpenCentroCostoDialog
                                }]
                            }
                        },
                        { name: 'CONCEPTO_ASIENTO', index: 'CONCEPTO_ASIENTO', align: "left", edittype: 'text', hidden: (_altaAsientoFn.esGeneral == "General"), editable: true }
                      ],
                onSelectRow: function (rowId) {
                    if (_altaAsientoFn.LastRowId != rowId) {
                        _altaAsientoFn.GridSelector.jqGrid('saveRow', _altaAsientoFn.LastRowId, false); // se guarda la Fila que estaba siendo editada

                        var cuentaOfSelectedRow = _altaAsientoFn.GridSelector.jqGrid('getCell', rowId, 'CUENTA');
                        var primerNroCuenta = cuentaOfSelectedRow.toString().charAt(0);
                        var CONCEPTO_ASIENTOOfSelectedRow = _altaAsientoFn.GridSelector.jqGrid('getCell', rowId, 'CONCEPTO_ASIENTO');

                        _altaAsientoFn.LastRowId = rowId;
                        _altaAsientoFn.GridSelector.jqGrid('editRow', rowId)

                        if (primerNroCuenta != "5") {
                            _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "ID_CENTRO", "0");
                            _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "CENTRO", " ");
                        }
                    }
                },
                ondblClickRow: function (rowId) {

                },
                beforeEditCell: function (rowid, cellname, value, iRow, iCol) {
                },
                editoptions: {},
                beforeSubmit: function (data) {
                }
            });
        },

        Save: function () {
            var gridData = _altaAsientoFn.GridSelector.jqGrid('getGridParam', 'data');
            debugger;
            var comprobante = $("#txtComprobante").val();
            var concepto = $("#txtConceptoAsiento").val();
            var fecha = $("#txtFecha").val();

            if (isEmpty(fecha)) { _showError("Ingrese una fecha"); return false; }

            var idToDelete = new Array();
            var correspondeCtroCosto = new Array();

            for (i = 0; i < gridData.length; i++) {
                _altaAsientoFn.GridSelector.jqGrid('saveRow', gridData[i].id); //se guardan las filas en caso de que una haya quedado en modo edición

                var primerNroCuenta = isEmpty(gridData[i].CUENTA) ? 0 : gridData[i].CUENTA.toString().charAt(0);

                if (isEmpty(gridData[i].CUENTA)) {
                    idToDelete.push(gridData[i].id)
                } else if (primerNroCuenta == "5" && (isEmpty(gridData[i].ID_CENTRO) || gridData[i].ID_CENTRO == 0)) {
                    correspondeCtroCosto.push(gridData[i])
                }
            }

            for (i = 0; i < idToDelete.length; i++) {
                _altaAsientoFn.GridSelector.jqGrid("delRowData", idToDelete[i]);
            }

            var errMsg = "Se debe indicar un centro de costo para la/s cuenta/s: ";
            let ccError = false;
            for (const cc of correspondeCtroCosto) {
                if(cc.DEBE != 0 || cc.HABER != 0){
                    errMsg += cc.CUENTA + ",";
                    ccError = true;
                }
            }
            if(ccError){
                errMsg = errMsg.substring(0, errMsg.length - 1)//se remueve la ultima ","
                _showError(errMsg); 
                return false;
            }

            var param = "";

            gridData = _altaAsientoFn.GridSelector.jqGrid('getGridParam', 'data');

            let sumaDebe = 0;
            let sumaHaber = 0;
            const cuentas = [];
            for (const c of gridData) {
                var s = c.CUENTA + "Ç" + c.DEBE + "Ç" + c.HABER + "Ç" + c.ID_CENTRO + "Ç" + c.CONCEPTO_ASIENTO;
                if(c.DEBE != 0 || c.HABER != 0)
                    cuentas.push(s);

                sumaDebe += c.DEBE;
                sumaHaber += c.HABER;
            }
            if(cuentas.length == 0){
                _showError("No se ingresó ninguna cuenta con importes validos."); return;
            }

            param = cuentas.join(',');

      

            this.CalcularTotales();
            var diferencia = parseFloat($("#txtDiferencia").val());
            if (diferencia != 0) { _showError("No coincide la partida doble"); return false; }

            param = param.substring(0, param.length - 1)

            _showLoading();

            $.ajax({
                url: "../../Diario/ModificarOGrabarAsiento",
                data: "gridData=" + param + "&concepto=" + concepto + "&fecha=" + fecha + "&comprobante=" + comprobante + "&subsistema=" + _altaAsientoFn.Subsistema + "&asiento=" + _altaAsientoFn.NroAsiento,
                datatype: "POST", dataType: "json",
                type: 'POST',
                success: function () {
                    $("#GrillaAltaAsiento").GridUnload();
                    $("#AltaAsientos").dialog("close");
                    $("#mostrar").click();
                    _hideLoading();
                },
                error: function () {
                    debugger;
                    _hideLoading();
                    _showError("Ha ocurrido un error");
                }
            });

            return true;
        },

        Inicializar: function (modo, subsistema, concepto, comprobante, fecha, asiento, codOP, numOP) {
            this.IdCount = 1;
            this.LastRowId = 0;

            $("#txtComprobante, #txtFecha, #txtConceptoAsiento").val("").attr("disabled", false);
            $("#txtTotalDebe, #txtTotalHaber, #txtDiferencia").val("0.00");

            this.GridSelector.jqGrid("clearGridData", true);

            this.PartialViewMode = modo;
            this.Subsistema = subsistema;
            this.esGeneral = subsistema;
            debugger;
            if (this.esGeneral == "General") {
                _altaAsientoFn.GridSelector.showCol('CONCEPTO_ASIENTO')
                //_altaAsientoFn.GridSelector.GridUnload();
                _altaAsientoFn.CreateGrid();
            } else {
                _altaAsientoFn.GridSelector.hideCol('CONCEPTO_ASIENTO')
                //_altaAsientoFn.GridSelector.GridUnload();
                _altaAsientoFn.CreateGrid();
            }

            this.NroAsiento = isEmpty(asiento) ? 0 : asiento;

            if (modo == "edit") {
                $("#txtComprobante").val(comprobante);
                $("#txtFecha").val(fecha);
                $("#txtConceptoAsiento").val(concepto);

                var lcUrl = "";

                switch (subsistema) {
                    case "General":
                        var lcUrl = '/Diario/BuscaAsientoGeneral';
                        break
                    case "Cajadia":
                        var lcUrl = '/Diario/BuscaAsientoCajadia';
                        break

                    case "Compras":
                        var lcUrl = '/Diario/BuscaAsientoCompras';
                        break
                    case "Ventas":
                        var lcUrl = '/Diario/BuscaAsientoVentas';
                        break

                    default:
                        var lcUrl = '/Diario/BuscaAsientoGeneral';
                };

                _showLoading();

                $.ajax({
                    type: "POST", dataType: "json",
                    data: "codop=" + codOP + "&numop=" + numOP + "&asiento=" + asiento,
                    url: lcUrl,
                    success: function (data) {
                        $.each(data, function (index, x) {
                            var denomina = "";
                            $.ajax({
                                url: '/PlanCuenta/ObtenerCuentaByCuenta' + '/' + x.CUENTA,
                                success: function (data) {
                                    denomina = data.DENOMINA;

                                    var newRow = {
                                        NRO_ASIENTO: asiento,
                                        CUENTA: x.CUENTA,
                                        DEBE: x.DEBE,
                                        HABER: x.HABER,
                                        ID_CENTRO: x.CENTRO,
                                        CENTRO: x.NOMBRE_CENTRO,
                                        DENOMINA: denomina,
                                        CONCEPTO_ASIENTO: x.CONCEPTO_ASIENTO
                                    }

                                    _altaAsientoFn.GridSelector.jqGrid("addRowData", _altaAsientoFn.IdCount, newRow); _altaAsientoFn.IdCount++;
                                    _altaAsientoFn.CalcularTotales();
                                },
                                error: function (e, err) {
                                    alert(e);
                                    _hideLoading();
                                }
                            });
                        })
                        _hideLoading();
                    }
                });


            }
        },

        AsientoModeloDialog: $("#popUpAsientoModelo").dialog({
            autoOpen: false,
            resizable: false,
            height: 'auto',
            width: 'auto',
            z_index: 1006,
            top: 130,
            left: 418,
            modal: true,
            title: "Asientos modelo"
        }),

        loadAsientoModelo: function (id) {

            _showLoading();
            setTimeout(function () {
                $.ajax({
                    url: "../../AsientoModelo/GetChilds",
                    data: "id=" + id,
                    datatype: "POST", dataType: "json",
                    type: 'POST',
                    success: function (data) {

                        _altaAsientoFn.GridSelector.jqGrid("clearGridData", true);


                        $(data).each(function () {

                            var row = {
                                CUENTA: this.CUENTA,
                                DENOMINA: this.NOMBRE_CUENTA,
                                ID_CENTRO: this.ID_CENTRO_COSTO,
                                CENTRO: this.NOMBRE_CENTRO_COSTO,
                                DEBE: 0,
                                HABER: 0
                            };

                            _altaAsientoFn.GridSelector.jqGrid('addRowData', _altaAsientoFn.IdCount, row);

                            _altaAsientoFn.IdCount++;
                        });


                        _altaAsientoFn.AsientoModeloDialog.dialog('close');

                        _hideLoading();
                    },
                    error: function () {
                        debugger;
                        _hideLoading();
                        _showError("Ha ocurrido un error");
                    }
                });
            }, 100);
        }
    };

    $("#btnAgregar").button().click(function () {
        _altaAsientoFn.GridSelector.jqGrid("addRowData", _altaAsientoFn.IdCount, {DEBE: 0, HABER: 0});

        _altaAsientoFn.IdCount++;
    });

    $("#btnQuitar").button().click(function () {
        var selectedRowId = _altaAsientoFn.GridSelector.jqGrid('getGridParam', 'selrow');

        _altaAsientoFn.GridSelector.jqGrid("delRowData", selectedRowId);

        _altaAsientoFn.CalcularTotales();
    });

    $("#btnModelo").button().click(function () {
        _altaAsientoFn.AsientoModeloDialog.dialog('open');
    });

    $("#txtFecha").datepicker({ dateFormat: 'dd/mm/yy' }).mask("99/99/9999");

    $(document).ready(function () {
        _altaAsientoFn.CreateGrid();
    });

    $("#popUpPlanCuentas .td-field").click(function (event) {
        var cuenta = $(event.target).parent().children()[0].innerHTML.trim();
        var denomina = $(event.target).parent().children()[1].innerHTML.trim();

        _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "CUENTA", cuenta);
        _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "DENOMINA", denomina);

        var primerNroCuenta = cuenta.toString().charAt(0);

        if (primerNroCuenta != "5") {
            _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "ID_CENTRO", "0");
            _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "CENTRO", " ");
        } else {
            _altaAsientoFn.GridSelector.jqGrid('saveRow', _altaAsientoFn.LastRowId, false); 

            _altaAsientoFn.GridSelector.jqGrid('editRow', _altaAsientoFn.LastRowId)
        }

        _altaAsientoFn.PlanCuentasDialog.dialog("close");
    });

    $("#popUpCentro .td-fieldCentroCosto").click(function () {
        _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "ID_CENTRO", $(event.target).parent().children()[0].innerHTML.trim())
        _altaAsientoFn.GridSelector.setCell(_altaAsientoFn.LastRowId, "CENTRO", $(event.target).parent().children()[1].innerHTML.trim())

        _altaAsientoFn.CentroCostoDialog.dialog("close");
    });

    $("#AsientosTable :input")
        .live("keydown",function(event){
            if(event.which == 13)
                _altaAsientoFn.GridSelector.jqGrid('saveRow', _altaAsientoFn.LastRowId);
        })
        .live("focusout", _altaAsientoFn.CalcularTotales);

    $("#popUpAsientoModelo tr:gt(1)")
    .css('cursor', 'pointer')
    .click(function (event) {
        _altaAsientoFn.loadAsientoModelo(event.target.id);
    });

</script>
</div>

<div id="popBorrado" class="popUp" style= "display:none; padding:0px,0px,0px,0px">
    <br />
     <b>¿Confirma el borrado del asiento?</b>
    <br />
    <br />

</div>

<div id="dialogBuscador" style="display:none;">
    
    <table>
        <tr>
            <th><span style="text-decoration:underline;">Campo a buscar</span></th>
            <th><span style="text-decoration:underline;">Valor</span></th>
        </tr>

        <tr>
            <td style="float:right;">TIPO <input type="radio" tabindex="-1" name="filtro" value="tipo" id="tipo" /> </td>
            <td><select tabindex="2" id="txtTipo" style="max-width:100%;" disabled="disabled"></select> </td>
        </tr>

        <tr>
            <td>COMPROBANTE <input type="radio" tabindex="1" name="filtro" value="comprobante" id="comprobante" /> </td>
            <td><input type="text" tabindex="2" id="txtComp" value="" style="width:97.5%; margin-left:1px;" disabled="disabled" /></td>
        </tr>
        <tr>
            <td style="float:right;">Nº ASIENTO <input type="radio" tabindex="1" name="filtro" value="asiento" id="asiento" /> </td>
            <td><input type="text" tabindex="2" id="txtAsiento" value="" style="width:97.5%; margin-left:1px;" disabled="disabled" /></td>
        </tr>
        <tr>
            <td style="float:right;">IMPORTE <input type="radio" tabindex="2" name="filtro" value="importe" id="importe" /> </td>
            <td>
                <input type="text" tabindex="2" id="txtImpoDesde" value="" placeholder="Desde.." 
                        style="width:48%; margin-left:2px;" disabled="disabled" onkeypress='validateNumbers(event, true);' />
                
                <input type="text" tabindex="2" id="txtImpoHasta" value="" placeholder="Hasta.." 
                        style="width:47%;" disabled="disabled" onkeypress='validateNumbers(event, true);' />
            </td>
        </tr>
        <tr>
            <td style="float:right;">CONCEPTO <input type="radio" tabindex="2" name="filtro" value="concepto" id="concepto" /> </td>

            <td>
                <input type="text" id="txtConcepto" style="width: 329px; margin-left: 1px;" disabled/>
            </td>
        </tr>
    </table>

</div>